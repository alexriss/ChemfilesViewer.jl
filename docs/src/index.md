```@meta
CurrentModule = ChemfilesViewer
```

# ChemfilesViewer

Documentation for [ChemfilesViewer](https://github.com/alexriss/ChemfilesViewer.jl).

## About

A julia library to visualize chemical molecules and other structures in the [Chemfiles](https://github.com/chemfiles/Chemfiles.jl) format.

## Usage

```julia
using ChemfilesViewer

# read molecule
mol = load_molecule("mol.sdf")

# render molecule
render_molecule(mol)
# render another molecule in the same window
render_molecule!(mol)

# save reference to last used output
viewer_id = get_current_chemviewer_id()
    
# change properties
d = generate_dict_molecule(mol)
d["atoms"][1]["color"] = "#f00000"
d["atoms"][1]["label"] = "Important atom"
d["atoms"][1]["radius"] = 1.0
render_dict_molecule(d, chemviewer_id=viewer_id)

# add labels
d["labels"] = [
    Dict(
        "label" => "porphyrin",
        "location" => [0,0,2],
        "color" => "#600000"
    ),
    Dict(
        "label" => "pyrrole",
        "location" => [-0.6, 3.2, 0],
        "style" => "font-size:80%;opacity:0.5;"
    )
]
render_dict_molecule!(d, options=Dict("showLabels" => true))

# change view
set_camera_position!("x", "-")
set_options!(Dict("drawingType" => "wireframe"))
set_camera_position!("c", "+")
set_options!(Dict("drawingType" => "ball and stick"))

# change style
set_options!(Dict("styles" => Dict(
    "H" => Dict("color" => "#c0c0c0", "radius" => 0.4),
    "N" => Dict("color" => "#241571"),
    "bond" => Dict("color" => "#ffffff", "radius" => 0.3)
)))

# clar labels (atom-labels are kept, though)
clear_labels!()

# add label
add_label!(Dict(
    "label" => "some other text",
    "location" => [2,5,5],
    "style" => "font-weight:bold;color:blue;font-size:3em;"
))

# save image
save_image("test.png")
# save labels (this is somewhat experimental)
save_image_labels("test_labels.png")
# save the overlay of the render and the labels
save_overlay("test.png", "test_labels.png", "test_both.png")
```

Use mouse to rotate, zoom and pan. Keyboard shortcuts `x`, `y`, `z` set the view along the x, y and z axis.
Analogously, `a`, `b`, `c` set the view along the unit cell vectors. Uppercase letters (`X`, `Y`, `Z`, `A`, `B`, `C`) set the opposite view direction.

A more detailed description can be found in the [Reference](@ref)
