module ChemfilesViewer

using Base64
using Chemfiles
using Blink
using JSON
using Images
using UUIDs
using WebIO

export generate_dict_molecule, render_dict_molecule, render_dict_molecule!,
    render_molecule, render_molecule!, set_camera_position!, set_options!,
    clear_labels!, add_label!,
    save_image, save_image_labels, save_overlay,
    get_current_chemviewer_id


# javascript jobs
mutable struct Job
    finished::Bool
    condition::Condition
    parameters::Dict{String,Any}
    Job(parameters) = new(false, Condition(), parameters)
end

# Observables for bidirectional communication
mutable struct BiObservable
    julia::Observable
    js::Observable
end

MAX_TIME_JOB = 5  # maximum execution time of a job
DEBUG = false

const file_logo = "../frontend/assets/logo.png"

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
    function generate_dict_molecule(molecule::Chemfiles.Frame; atom_labels=false)

Generate a dictionary for the `molecule` specifying the atoms, bonds and unit cell.
If `atom_labels` is true, then labels will be generated for each atom.
"""
function generate_dict_molecule(molecule::Chemfiles.Frame; atom_labels=false)
    dict_molecule = Dict("atoms" => [], "bonds" => [], "unitcell" => [], "labels" => [])
    
    pos = positions(molecule)
    types = [type(a) for a in molecule]

    for (i,t) in enumerate(types)
        d_atom = Dict(
            "element" => t,
            "location" => pos[:,i]
        )
        if atom_labels
            d_atom["label"] = "$(t)_$(i-1)"
        end
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
        abspath_logo = abspath(joinpath(@__DIR__, file_logo))
        window = Window(async=false, Dict(
            "webPreferences" => Dict("webSecurity" => false),  # to load local files
            "title" => "Chemfiles Viewer",
            "icon" => abspath_logo,
        ))
        Blink.@js window require("electron").remote.getCurrentWindow().setMenuBarVisibility(false)
        Blink.@js window require("electron").remote.getCurrentWindow().setIcon($abspath_logo)

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
            set_options!(options, chemviewer_id=chemviewer_id)
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
            @async handle_job(value)
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
    function queue_job(observable, parameters)

Queues a job to be handled by javascript.
"""
function queue_job(chemviewer_id::String, observable::Observable, parameters::Dict{String,<:Any}, wait_until_finished::Bool=false)
    job_id = string(UUIDs.uuid4())
    global jobs[job_id] = Job(parameters)
    observable[] = [chemviewer_id, parameters["command"], Dict("jobID" => job_id)]
    @async job_timeout(job_id)
    
    # todo: this does not yet seem to work properly
    if wait_until_finished
        wait(jobs[job_id].condition)
    end
    return
end


"""
    function handle_job(value::Vector{Any})

Handles responses from javascript jobs.
"""
function handle_job(value::Vector{Any})
    global jobs
    job_id = value[3]["jobID"]
    if !haskey(jobs, job_id) || jobs[job_id].finished
        @warn """Job $(jobs[job_id].parameters["command"]) finished too late."""
        return
    end
    if value[2] == "returnPngString" || value[2] == "returnPngStringLabels"
        write_image(jobs[job_id].parameters["filename"], value[3]["val"])
        
        notify(jobs[job_id].condition)
        jobs[job_id].finished = true  # this is not really necessary, but can be used in the future to give an ok to the user
        delete!(jobs, job_id)
    end
    return
end


"""
    function job_timeout()

"""
function job_timeout(job_id)
    sleep(MAX_TIME_JOB)
    if haskey(jobs, job_id)
        notify(jobs[job_id].condition)
        @warn """Job "$(jobs[job_id].parameters["command"])" did not return a value."""
    end
    return
end


"""
    function render_molecule(molecule::Chemfiles.Frame; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}(), atom_labels=false, output::String="")

Render the `molecule` (a Chemfiles frame). If `chemviewer_id` is not given, a new electron window will be created.
Additional `options` for rendering can be provided.

If `atom_labels` is true, then labels will be generated for each atom.

The parameter `output` specfies whether to display the render in an external window (when set to `external`)
or inline within Jupyter or Pluto (when set to `inline`).
Leaving `output` empty will autodetect the output medium.
"""
function render_molecule(molecule::Chemfiles.Frame; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}(), atom_labels=false, output::String="")
    dict_molecule = generate_dict_molecule(molecule, atom_labels=atom_labels)
    return render_dict_molecule(dict_molecule, chemviewer_id=chemviewer_id, options=options, output=output)
end

"""
    function render_molecule!(molecule::Chemfiles.Frame; options::AbstractDict{String,<:Any}=Dict{String,Any}(), output::String="")

Call [`render_molecule`](@ref) for the last used output plot.
"""
function render_molecule!(molecule::Chemfiles.Frame; options::AbstractDict{String,<:Any}=Dict{String,Any}(), atom_labels=false, output::String="")
    return render_molecule(molecule, chemviewer_id=current_chemviewer_id, options=options, atom_labels=atom_labels, output=output)
end


"""
    function set_camera_position!(axis::String="z", direction::String="+"; chemviewer_id::String="")

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
    function set_options!(options::AbstractDict{String,<:Any}; chemviewer_id::String="")

Set options for the render. Available options are: 

- `shader`: `basic`, `phong`, `lambert` *(default)*  
- `drawingType`: `ball and stick` *(default)*, `space filling`, `wireframe`  
- `cameraType`: `perspective` *(default)*, `orthographic`  
- `quality`: `high` *(default)*, `low`  
- `showUnitCell`: `true` *(default)*, `false`  
- `showLabels`: `true`, `false` *(default)*  
- `styles`: dictionary of element styles, e.g. `Dict("Au" => Dict("color" => "#f0f0c0", "radius" => 2.6))`
- `cameraFov`: field of view of the perspective camera, default is `40`  
- `cameraDistance`: distance of the perspective camera, will be automatic
- `cameraZoom`: camera zoom, default is `1`  
- `cameraAxis`: set the camera view along this axis (`x`, `y`, `z` *(default)* or the unit cell vectors `a`, `b`, `c`), see also [`set_camera_position!`](@ref)  
- `cameraAxisDirection`: direction of the camera along `cameraAxis`: `+` *(default)*, `-`  
- `hemisphereLightIntensity`: light intensity of hemiphere light, defaults to `1.0`  
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
    function add_label!(label::AbstractDict{String,<:Any}; chemviewer_id::String="")

Adds a labels. Examples:
```
add_label!(Dict(
    "label" => "label text",
    "location" => [0,0,2],
    "color" => "#f00000"
))

add_label!(Dict(
    "label" => "some other text",
    "location" => [2,5,5],
    "style" => "font-weight:bold;color:blue;"
))
```

If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function add_label!(label::AbstractDict{String,<:Any}; chemviewer_id::String="")
    window_obs, chemviewer_id = get_reference(chemviewer_id)
    if typeof(window_obs) == Blink.Window
        @js window_obs addLabel($chemviewer_id, $label)
    elseif typeof(window_obs) == BiObservable
        window_obs.julia[] = [chemviewer_id, "addLabel", label]
    else
        @error """Cannot find existing render. Call "render_molecule" first."""
    end
    return
end


"""
    function clear_labels!(; chemviewer_id::String="")

Removes all labels (except for the atom-labels) from the render.

If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function clear_labels!(; chemviewer_id::String="")
    window_obs, chemviewer_id = get_reference(chemviewer_id)
    if typeof(window_obs) == Blink.Window
        @js window_obs clearLabels($chemviewer_id)
    elseif typeof(window_obs) == BiObservable
        window_obs.julia[] = [chemviewer_id, "clearLabels", Dict()]
    else
        @error """Cannot find existing render. Call "render_molecule" first."""
    end
    return
end


"""
    function save_image(filename::AbstractString; chemviewer_id::String="")

Save a png image of the render to `filename`. The image size is specified by the parameters `renderWidth` and `renderHeight`,
which can be set by [`set_options!`](@ref).

Note that labels are not saved. To save the labels use [`save_image_labels`](@ref).

If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function save_image(filename::AbstractString; chemviewer_id::String="")
    window_obs, chemviewer_id = get_reference(chemviewer_id)
    if typeof(window_obs) == Blink.Window
        img_base64 = @js window_obs getPngString($chemviewer_id)
        write_image(filename, img_base64)
    elseif typeof(window_obs) == BiObservable
        queue_job(chemviewer_id, window_obs.julia, Dict("command" => "getPngString", "filename" => filename))
        # image will be saved in the `handle_job` function
    else
        @error """Cannot find existing render output. Call "render_molecule" first."""
    end

    return
end


"""
    function save_image_labels(filename::AbstractString; chemviewer_id::String="")

Save a png image of the labels in the render to `filename`. The image size is specified by the parameters `renderWidth` and `renderHeight`,
which can be set by [`set_options!`](@ref).

Note that this is an experimental feature. The resulting image might deviate from what is rendered in the output.

If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function save_image_labels(filename::AbstractString; chemviewer_id::String="")
    window_obs, chemviewer_id = get_reference(chemviewer_id)
    if typeof(window_obs) == Blink.Window
        img_base64 = @js window_obs getPngStringLabels($chemviewer_id)
        write_image(filename, img_base64)
    elseif typeof(window_obs) == BiObservable
        queue_job(chemviewer_id, window_obs.julia, Dict("command" => "getPngStringLabels", "filename" => filename))
        # image will be saved in the `handle_job` function
    else
        @error """Cannot find existing render output. Call "render_molecule" first."""
    end

    return
end


"""
    function save_overlay(filename::AbstractString, filename_input1::AbstractString, filename_input2::AbstractString)

Saves an image to `filename` that is constructed from overlaying `filename_input2` over `filename_input1`.
"""
function save_overlay(filename::AbstractString, filename_input1::AbstractString, filename_input2::AbstractString)
    img1 = load(filename_input1)
    img2 = load(filename_input2)
    if size(img1) != size(img2)
        @info "Input files have different sizes ($(size(img1)) and $(size(img2))). Resizing the second image to fit the first."
        img2 = imresize(img2, size(img1))
    end
    res = zero(img1)
    for i in eachindex(res)
        p1 = img1[i]
        p2 = img2[i]
        # see https://en.wikipedia.org/wiki/Alpha_compositing
        alphao = p2.alpha + p1.alpha * (1 - p2.alpha)
        if alphao == 0
            co = p1
        else
            co = (p2 * p2.alpha + p1 * p1.alpha * (1 - p2.alpha)) / alphao
        end
        res[i] = RGBA(co.r, co.g, co.b, alphao)
    end
    save(filename, res)
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
