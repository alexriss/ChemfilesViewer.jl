# ChemfilesViewer

[![Stable](https://img.shields.io/badge/docs-stable-blue.svg)](https://alexriss.github.io/ChemfilesViewer.jl/stable)
[![Dev](https://img.shields.io/badge/docs-dev-blue.svg)](https://alexriss.github.io/ChemfilesViewer.jl/dev)
[![Build Status](https://github.com/alexriss/test.jl/workflows/CI/badge.svg)](https://github.com/alexriss/ChemfilesViewer.jl/actions)


A julia library to visualize chemical molecules and other structures in the [Chemfiles](https://github.com/chemfiles/Chemfiles.jl) format.

## Usage

```julia
# read molecule using Chemfiles
using Chemfiles
trajectory = Trajectory("mol.xyz")
mol = read(trajectory)

# render molecule
w, _ = render_molecule(mol)
w, _ = render_molecule(mol, w)  # render another molecule in the same window

# change properties
d = generate_dict_molecule(mol)
d["atoms"][1]["color"] = "#f00000"
d["atoms"][1]["label"] = "Important atom"
d["atoms"][1]["radius"] = 3
w, _ = render_dict_molecule(d, w)
```

Use mouse to rotate, zoom and pan. Keyboard shortcuts `x`, `y`, `z` set the view along the x, y and z axis.
Analogously, `a`, `b`, `c` set the view alonmg the unit cell vectors. Uppercase letters (`X`, `Y`, `Z`, `A`, `B`, `C`) change the view direction.

## Notes

The javascript rendering is based on [Patrick Fuller's imolecule](https://github.com/patrickfuller/imolecule).

Currently, a new [Blink](https://github.com/JuliaGizmos/Blink.jl) window is opened for rendering. Integration into [Jupyter](https://jupyter.org/), [Pluto](https://github.com/fonsp/Pluto.jl) and [VSCode](https://code.visualstudio.com/) is planned in the future.