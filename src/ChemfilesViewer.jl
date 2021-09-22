module ChemfilesViewer

using Base64
using Chemfiles
using Blink
using JSON
using UUIDs

export generate_dict_molecule, render_dict_molecule, render_molecule, set_camera_position, set_options, save_image


DEBUG = false

current_chemviewer_id = ""  # holds the last used chemviewer_id
chemviewer_id_window = Dict{String, Blink.Window}()  # holds the windows associated with the respective chemviewer_ids

path_lib = normpath(@__DIR__, "..", "frontend")
tpl_html = joinpath(path_lib, "app", "index.html")
include_js = joinpath(path_lib, "build", "bundle.js")


isijulia() = isdefined(Main, :IJulia) && Main.IJulia.inited

ispluto() = isdefined(Main, :PlutoRunner)


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
    function render_dict_molecule(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())

Render the molecule from a dictionary containing the atoms, bonds and unit cell. If `chemviewer_id` is not given, a new electron window will be created.
Additional `options` for rendering can be provided.
Returns the id of the current chemviewer javascript object.
"""
function render_dict_molecule(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())
    chemviewer_setup_needed = false
    if chemviewer_id == ""
        chemviewer_setup_needed = true
        window = Window(async=false)

        if DEBUG
            opentools(window)
        end
        load!(window, include_js)

        html = read(tpl_html, String)
        chemviewer_id = string(UUIDs.uuid4())

        global chemviewer_id_window[chemviewer_id] = window

        html = replace(html, "{{ id }}" => chemviewer_id)
        body!(window, html)
    else
        window, chemviewer_id = get_window_chemviewer_id(chemviewer_id)
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
        end
        json_molecule = JSON.json(dict_molecule)
        @js window drawJsonString($chemviewer_id, $json_molecule)
    catch e
        msg = sprint(showerror, e)
        msg_full = sprint(showerror, e, catch_backtrace())
        @show msg
        @show msg_full
    finally
        return chemviewer_id
    end
end


"""
    function render_molecule(molecule::Chemfiles.Frame; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())

Render the `molecule` (a Chemfiles frame). If `chemviewer_id` is not given, a new electron window will be created.
Additional `options` for rendering can be provided.
Returns the id of the current chemviewer javascript object.
"""
function render_molecule(molecule::Chemfiles.Frame; chemviewer_id::String="", options::AbstractDict{String,<:Any}=Dict{String,Any}())
    dict_molecule = generate_dict_molecule(molecule)
    return render_dict_molecule(dict_molecule, chemviewer_id=chemviewer_id, options=options)
end


"""
    function set_camera_position(axis::String="z", direction::String="+"; chemviewer_id::String="")

Set the camera position to be along one of the axis `x`, `y`, `z` or the unit cell vectors `a`, `b`, `c`.
The direction of `+` or `-` specifies in which direction the camera is moved.
If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function set_camera_position(axis::String="z", direction::String="+"; chemviewer_id::String="")
    d = Dict(
        "cameraAxis" => axis,
        "cameraAxisDirection" => direction
    )
    
    set_options(d, chemviewer_id=chemviewer_id)
    return
end


"""
    get_window_chemviewer_id(window::Union{Blink.Window,Nothing}, chemviewer_id::String)

Helper function to get the most recent `window` and `chemviewer_id` parameters. 
"""
function get_window_chemviewer_id(chemviewer_id::String)
    if chemviewer_id == ""
        chemviewer_id = current_chemviewer_id
    end
    if chemviewer_id == ""
        error("Can't get current chemviewer_id. Try specifying the chemviewer_id parameter manually.")
        return nothing, ""
    end

    # save current window and chemviewer_id
    global current_chemviewer_id = chemviewer_id
    
    return chemviewer_id_window[chemviewer_id], chemviewer_id
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
- `cameraAxis`: set the camera view along this axis (`x`, `y`, `z` *(default)* or the unit cell vectors `a`, `b`, `c`), see also [`set_camera_position`](@ref)  
- `cameraAxisDirection`: direction of the camera along `cameraAxis`: `+` *(default)*, `-`  
- `hemisphereLightIntensity`: light intensity of hemiphere light, defaults to `0.8`  
- `directionalLightIntensity`: light intensity of directional light, defaults to `0.05`  
- `center`: center of the render, will be automatically calculated if not given  
- `rotateSpeed`: speed of rotation via mouse control, defaults to `2`  
- `renderWidth`: width of the saved image, default is `1600`  
- `renderHeight`: height of the saved image, default is `1600`

If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function set_options(options::AbstractDict{String,<:Any}; chemviewer_id::String="")
    window, chemviewer_id = get_window_chemviewer_id(chemviewer_id)
    @js window setOptions($chemviewer_id, $options)
    return
end


"""
    function save_image(filename::AbstractString; chemviewer_id::String="")

Save a png image of the render to `filename`. The image size is specified by the parameters `renderWidth` and `renderHeight`,
which can be set by [`set_options`](@ref).
If the `chemviewer_id` is not specified, the most recent instance is used. 
"""
function save_image(filename::AbstractString; chemviewer_id::String="")
    window, chemviewer_id = get_window_chemviewer_id(chemviewer_id)

    img_base64 = @js window get_png_string($chemviewer_id)
    img = base64decode(img_base64[23:end])
    write(filename, img)
    return
end


end
