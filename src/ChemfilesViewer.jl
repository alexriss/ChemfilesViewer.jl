module ChemfilesViewer

using Base64
using Chemfiles
using Blink
using JSON
using UUIDs
using WebIO

export generate_dict_molecule, render_dict_molecule, render_dict_molecule!,
    render_molecule, render_molecule!, set_camera_position!, set_options!, save_image,
    get_current_chemviewer_id


# javascript jobs
mutable struct Job
    finished::Bool
    parameters::Dict{String,Any}
end

# Observables for bidirectional communication
mutable struct BiObservable
    julia::Observable
    js::Observable
end


DEBUG = false

current_chemviewer_id = ""  # holds the last used chemviewer_id
chemviewer_id_reference = Dict{String, Union{Blink.Window, BiObservable}}()  # holds the windows or observables (see WebIO) associated with the respective chemviewer_ids
jobs = Dict{String, Job}()  # keeps track of javascript jobs

path_lib = normpath(@__DIR__, "..", "frontend")
tpl_html = joinpath(path_lib, "app", "index.html")
include_js = joinpath(path_lib, "build", "bundle.js")


isijulia() = isdefined(Main, :IJulia) && Main.IJulia.inited

ispluto() = isdefined(Main, :PlutoRunner)


"""
    get_reference(chemviewer_id::String)

Helper function to get the most recent output reference (i.e. `Window` or Vector of `Observable`) associated with the given `chemviewer_id`. 
"""
function get_reference(chemviewer_id::String)
    if chemviewer_id == ""
        chemviewer_id = current_chemviewer_id
    end
    if chemviewer_id == ""
        error("Can't get current chemviewer_id. Try specifying the chemviewer_id parameter manually.")
        return nothing, ""
    end
    if !(haskey(chemviewer_id_reference, chemviewer_id))
        @info "Can't get chemviewer_id $chemviewer_id."  # no error, we can continue
        return nothing, ""
    end

    # save current window and chemviewer_id
    global current_chemviewer_id = chemviewer_id
    
    return chemviewer_id_reference[chemviewer_id], chemviewer_id
end


"""
    get_current_chemviewer_id()

Returns the id of the current chemviewer instance. This can be passed to the `chemviewer_id` parameters
in the functions [`render_molecule`](@ref), [`render_dict_molecule`](@ref), [`set_options!`](@ref), [`set_camera_position!`](@ref).
"""
function get_current_chemviewer_id()
    return current_chemviewer_id
end


"""
    generate_dict_molecule(molecule::Chemfiles.Frame)

Generate a dictionary for the `molecule` specifying the atoms, bonds and unit cell.
"""
function generate_dict_molecule(molecule::Chemfiles.Frame)
    dict_molecule = Dict("atoms" => [], "bonds" => [], "unitcell" => [])
    
    pos = positions(molecule)
    types = [type(a) for a in molecule]

    for (i,t) in enumerate(types)
        d_atom = Dict(
            "element" => t,
            "label" => "$(t)_$(i-1)",
            "location" => pos[:,i]
        )
        push!(dict_molecule["atoms"], d_atom)
    end

    # create graph
    bond_atoms = bonds(Topology(molecule))
    if length(bond_atoms) == 0
        guess_bonds!(molecule)
        bond_atoms = bonds(Topology(molecule))
    end
    bond_order = bond_orders(Topology(molecule))

    for i in 1:size(bond_atoms, 2)
        bo = 1
        if bond_order[i] == Chemfiles.DoubleBond
            bo = 2
        elseif bond_order[i] == Chemfiles.TripleBond
            bo = 3
        elseif bond_order[i] == Chemfiles.QuadrupleBond
            bo = 4
        end

        d_bond = Dict(
            "atoms" => [bond_atoms[1,i], bond_atoms[2,i]],
            "order" => bo
        )
        push!(dict_molecule["bonds"], d_bond)
    end

    c = matrix(UnitCell(molecule))
    if any(c .!= 0)
        for i in 1:3
            push!(dict_molecule["unit_cell"], c[:,i])
        end
    end

    return dict_molecule
end


"""
    render_dict_molecule(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")

Render the molecule from a dictionary containing the atoms, bonds and unit cell. If `chemviewer_id` is not given, a new electron window will be created.
Additional `options` for rendering can be provided.
The parameter `output` specfies whether to display the render in an external window (when set to `external`)
or inline within Jupyter or Pluto (when set to `inline`).
Leaving `output` empty will autodetect the output medium.
"""
function render_dict_molecule(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")
    iswebio = isijulia() || ispluto()

    if !(output in ["external", "inline", ""])
        @info """Output parameter should be "external", "inline" or left empty ofr auto-detection."""
        output = ""
    end
    if (output == "inline" && !iswebio)
        @info """Did not detect Jupyter or Pluto environment. Inline display will likely not work."""
    end

    if output == "external"
        render_dict_molecule_external(dict_molecule, chemviewer_id=chemviewer_id, options=options)
    elseif output == "inline"
        render_dict_molecule_inline(dict_molecule, chemviewer_id=chemviewer_id, options=options)
    elseif iswebio
        render_dict_molecule_inline(dict_molecule, chemviewer_id=chemviewer_id, options=options)
    else
        render_dict_molecule_external(dict_molecule, chemviewer_id=chemviewer_id, options=options)
    end
end

"""
    render_dict_molecule!(dict_molecule::AbstractDict{String,<:Any}; options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")

Call [`render_dict_molecule`](@ref) for the last used output plot.
"""
function render_dict_molecule!(dict_molecule::AbstractDict{String,<:Any}; options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")
    render_dict_molecule(dict_molecule, chemviewer_id=current_chemviewer_id, options=options, output=output)
end

    
"""
    function render_dict_molecule_external(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())

Render the molecule from a dictionary containing the atoms, bonds and unit cell. If `chemviewer_id` is not given, a new electron window will be created.
Additional `options` for rendering can be provided. The render is shown in an external window.
"""
function render_dict_molecule_external(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())
    chemviewer_setup_needed = false
    if chemviewer_id != ""
        window, chemviewer_id = get_reference(chemviewer_id)
        if !(typeof(window) == ChemfilesViewer.Window) || !Blink.AtomShell.active(window)  # user closed the window
            chemviewer_id = ""
        end
    end

    if chemviewer_id == ""
        chemviewer_setup_needed = true
        window = Window(async=false)

        if DEBUG
            opentools(window)
        end
        load!(window, include_js)

        html = read(tpl_html, String)
        chemviewer_id = string(UUIDs.uuid4())

        global chemviewer_id_reference[chemviewer_id] = window

        html = replace(html, "{{ id }}" => chemviewer_id)
        body!(window, html)
    else
        window, chemviewer_id = get_reference(chemviewer_id)
    end

    # save current window and chemviewer_id
    global current_chemviewer_id = chemviewer_id

    try
        # check if js functions are initialized
        for i in 1:100
            res = @js window typeof(setupChemViewer)
            if res == "function"
                break
            end
            sleep(0.05)
        end

        if chemviewer_setup_needed
            @js window setupChemViewer($options)
        else
            set_options(options, chemviewer_id=chemviewer_id)
        end
        json_molecule = JSON.json(dict_molecule)
        @js window drawJsonString($chemviewer_id, $json_molecule)
    catch e
        msg = sprint(showerror, e)
        msg_full = sprint(showerror, e, catch_backtrace())
        @show msg
        @show msg_full
    finally
        return
    end
end


"""
    function render_dict_molecule_inline(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())

Render the molecule from a dictionary containing the atoms, bonds and unit cell. If `chemviewer_id` is not given, a new electron window will be created.
Additional `options` for rendering can be provided. The render is shown inline in [Jupyter](https://jupyter.org/) or [Pluto](https://github.com/fonsp/Pluto.jl).
"""
function render_dict_molecule_inline(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())
    if chemviewer_id != ""
        bi_obs,  chemviewer_id = get_reference(chemviewer_id)
        if (typeof(bi_obs) != BiObservable)
            chemviewer_id = ""
        end
    end
    
    json_molecule = JSON.json(dict_molecule)

    if chemviewer_id == ""
        scope = Scope(imports=[ChemfilesViewer.include_js])
        obs = Observable(scope, "from_julia", ["chemviewer_id", "what", Dict()])
        obs_js = Observable(scope, "from_js", ["chemviewer_id", "what", Dict()])

        html = read(tpl_html, String)
        chemviewer_id = string(UUIDs.uuid4())
        html = replace(html, "{{ id }}" => chemviewer_id)

        global chemviewer_id_reference[chemviewer_id] = BiObservable(obs, obs_js)
        global current_chemviewer_id = chemviewer_id  # save current window and chemviewer_id

        # javascript handler reacts to changes sent from julia
        onjs(obs, @js args -> begin
            window.__webIOScope = _webIOScope
            communicate(args)
        end)

        # julia handler reacts to changes sent from javascript
        on(obs_js) do value
            handle_job(value)
        end

        # make the ChemViewer class and the _webIOScope accessible within the js functions
        onimport(scope, js"""
            function (val) {
                setupChemViewerAndDraw_WebIO(val, $json_molecule, $options)
                window.chemviewer_objects["_webIOScope_" + $chemviewer_id] = _webIOScope;
            }
        """)
        return scope(HTML(html))
    else
        bi_obs, chemviewer_id = get_reference(chemviewer_id)

        global current_chemviewer_id = chemviewer_id  # save current window and chemviewer_id
        bi_obs.julia[] = [chemviewer_id, "setOptions", options]
        bi_obs.julia[] = [chemviewer_id, "drawJsonString", json_molecule]
        return
    end
end


"""
    function handle_job(value::Arra{Any,Any})

Handles responses from javascript jobs.
"""
function handle_job(value::Vector{Any})
    global jobs
    job_id = value[3]["jobID"]
    if value[2] == "returnPngString"
        write_image(jobs[job_id].parameters["filename"], value[3]["val"])
        
        jobs[job_id].finished = true  # this is not really necessary, but can be used in the future to give an ok to the user
        delete!(jobs, job_id)
    end
end


"""
    function render_molecule(molecule::Chemfiles.Frame; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())

Render the `molecule` (a Chemfiles frame). If `chemviewer_id` is not given, a new electron window will be created.
Additional `options` for rendering can be provided.
The parameter `output` specfies whether to display the render in an external window (when set to `external`)
or inline within Jupyter or Pluto (when set to `inline`).
Leaving `output` empty will autodetect the output medium.
"""
function render_molecule(molecule::Chemfiles.Frame; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")
    dict_molecule = generate_dict_molecule(molecule)
    return render_dict_molecule(dict_molecule, chemviewer_id=chemviewer_id, options=options, output=output)
end

"""
    render_molecule!(molecule::Chemfiles.Frame; options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")

Call [`render_molecule`](@ref) for the last used output plot.
"""
function render_molecule!(molecule::Chemfiles.Frame; options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")
    return render_molecule(molecule, chemviewer_id=chemviewer_id, options=options, output=output)
end


"""
    function set_camera_position(axis::String="z", direction::String="+"; chemviewer_id::String="")

Set the camera position to be along one of the axis `x`, `y`, `z` or the unit cell vectors `a`, `b`, `c`.
The direction of `+` or `-` specifies in which direction the camera is moved.
If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function set_camera_position!(axis::String="z", direction::String="+"; chemviewer_id::String="")
    d = Dict(
        "cameraAxis" => axis,
        "cameraAxisDirection" => direction
    )
    
    set_options!(d, chemviewer_id=chemviewer_id)
    return
end


"""
    function set_options(options::AbstractDict{String,<:Any}; chemviewer_id::String="")

Set options for the render. Available options are: 

- `shader`: `basic`, `phong`, `lambert` *(default)*  
- `drawingType`: `ball and stick` *(default)*, `space filling`, `wireframe`  
- `cameraType`: `perspective` *(default)*, `orthographic`  
- `quality`: `high` *(default)*, `low`  
- `showUnitCell`: `true` *(default)*, `false`  
- `showLabels`: `true`, `false` *(default)*  
- `cameraFov`: field of view of the perspective camera, default is `40`  
- `cameraDistance`: distance of the perspective camera, will be automatic
- `cameraZoom`: camera zoom, default is `1`  
- `cameraAxis`: set the camera view along this axis (`x`, `y`, `z` *(default)* or the unit cell vectors `a`, `b`, `c`), see also [`set_camera_position!`](@ref)  
- `cameraAxisDirection`: direction of the camera along `cameraAxis`: `+` *(default)*, `-`  
- `hemisphereLightIntensity`: light intensity of hemiphere light, defaults to `0.8`  
- `directionalLightIntensity`: light intensity of directional light, defaults to `0.05`  
- `center`: center of the render, will be automatically calculated if not given  
- `rotateSpeed`: speed of rotation via mouse control, defaults to `2`  
- `renderWidth`: width of the saved image, default is `1600`  
- `renderHeight`: height of the saved image, default is `1600`

If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function set_options!(options::AbstractDict{String,<:Any}; chemviewer_id::String="")
    window_obs, chemviewer_id = get_reference(chemviewer_id)
    if typeof(window_obs) == Blink.Window
        @js window_obs setOptions($chemviewer_id, $options)
    elseif typeof(window_obs) == BiObservable
        window_obs.julia[] = [chemviewer_id, "setOptions", options]
    else
        @error """Cannot find existing render. Call "render_molecule" first."""
    end
    return
end


"""
    function save_image(filename::AbstractString; chemviewer_id::String="")

Save a png image of the render to `filename`. The image size is specified by the parameters `renderWidth` and `renderHeight`,
which can be set by [`set_options!`](@ref).
If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function save_image(filename::AbstractString; chemviewer_id::String="")
    window_obs, chemviewer_id = get_reference(chemviewer_id)
    if typeof(window_obs) == Blink.Window
        img_base64 = @js window getPngString($chemviewer_id)
    elseif typeof(window_obs) == BiObservable
        job_id = string(UUIDs.uuid4())
        global jobs[job_id] = Job(false, Dict("command" => "getPngString", "filename" => filename))
        window_obs.julia[] = [chemviewer_id, "getPngString", Dict("jobID" => job_id)]
        # image will be saved in the `handle_job` function
    else
        @error """Cannot find existing render output. Call "render_molecule" first."""
    end

    write_image(filename, img_base64)

    return
end


"""
    function write_image(filename::AbstractString, img_base64::String)

Saves a base64 image string to a file.
"""
function write_image(filename::AbstractString, img_base64::String)
    img = base64decode(img_base64[23:end])
    write(filename, img)
    return
end


end
