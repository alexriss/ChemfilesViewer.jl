module ChemfilesViewer

using Chemfiles
using Blink
using JSON
using UUIDs

DEBUG = false

path_lib = normpath(@__DIR__, "..", "frontend")
tpl_html = joinpath(path_lib, "app", "index.html")
include_js = joinpath(path_lib, "build", "bundle.js")

"""
    generate_dict_molecule(molecule::Chemfiles.Frame, params::AbstractDict)

Generates a dictionary for the `molecule` specifying the atoms, bonds and unit cell.
"""
function generate_dict_molecule(molecule::Chemfiles.Frame, params::AbstractDict=Dict())
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
        guess_bonds!(mol)
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
    render_dict_molecule(dict_molecule::AbstractDict, window::Blink.Window=nothing)

Renders the molecule from a dictionary containing the atoms, bonds and unit cell. If `window` is given, this window will be reused.
if `reload_page` is `true`, then the html code will be reloaded.
Returns the current `window` instance and the id of the chemviewer javascript object.
"""
function render_dict_molecule(dict_molecule::AbstractDict, window::Union{Blink.Window,Nothing}=nothing; reload_page::Bool=false)
    if window === nothing
        window = Window(async=false)
        if DEBUG
            opentools(window)
        end
        reload_page = true;
    end

    if reload_page
        html = read(tpl_html, String)
        chemviewer_id = string(UUIDs.uuid4())
        html = replace(html, "{{ id }}" => chemviewer_id)

        load!(window, include_js)
        body!(window, html)
    end

    json_molecule = JSON.json(dict_molecule)

    try
        # check if js functions are initialized
        for i in 1:100
            res = @js window typeof(setupChemViewer)
            if res == "function"
                break
            end
            sleep(0.05)
        end

        @js window setupChemViewer()
        @js window drawJsonString($chemviewer_id, $json_molecule)
    finally
        return window, chemviewer_id
    end
end


"""
    render_molecule(molecule::Chemfiles.Frame, window=nothing)

Renders the `molecule` (a Chemfiles frame). If `window` is not given, a new electron window will be created.
if `reload_page` is `true`, then the html code will be reloaded.
Returns the current `window` instance and the id of the chemviewer javascript object.
"""
function render_molecule(molecule::Chemfiles.Frame, window::Union{Blink.Window,Nothing}=nothing; reload_page::Bool=false)
    dict_molecule = generate_dict_molecule(molecule)
    return render_dict_molecule(dict_molecule, window)
end





end
