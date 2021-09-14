var documenterSearchIndex = {"docs":
[{"location":"reference/#Reference","page":"Reference","title":"Reference","text":"","category":"section"},{"location":"reference/","page":"Reference","title":"Reference","text":"","category":"page"},{"location":"reference/","page":"Reference","title":"Reference","text":"Modules = [ChemfilesViewer]","category":"page"},{"location":"reference/#ChemfilesViewer.generate_dict_molecule-Tuple{Chemfiles.Frame}","page":"Reference","title":"ChemfilesViewer.generate_dict_molecule","text":"generate_dict_molecule(molecule::Chemfiles.Frame)\n\nGenerate a dictionary for the molecule specifying the atoms, bonds and unit cell.\n\n\n\n\n\n","category":"method"},{"location":"reference/#ChemfilesViewer.get_window_chemviewer_id-Tuple{String}","page":"Reference","title":"ChemfilesViewer.get_window_chemviewer_id","text":"get_window_chemviewer_id(window::Union{Blink.Window,Nothing}, chemviewer_id::String)\n\nHelper function to get the most recent window and chemviewer_id parameters. \n\n\n\n\n\n","category":"method"},{"location":"reference/#ChemfilesViewer.render_dict_molecule-Tuple{AbstractDict{String, var\"#s14\"} where var\"#s14\"}","page":"Reference","title":"ChemfilesViewer.render_dict_molecule","text":"function render_dict_molecule(dict_molecule::AbstractDict{String,<:Any}; chemviewer_id::String=\"\", options::AbstractDict{String,<:Any}=Dict{String,Any}())\n\nRender the molecule from a dictionary containing the atoms, bonds and unit cell. If chemviewer_id is not given, a new electron window will be created. Additional options for rendering can be provided. Returns the id of the current chemviewer javascript object.\n\n\n\n\n\n","category":"method"},{"location":"reference/#ChemfilesViewer.render_molecule-Tuple{Chemfiles.Frame}","page":"Reference","title":"ChemfilesViewer.render_molecule","text":"function render_molecule(molecule::Chemfiles.Frame; chemviewer_id::String=\"\", options::AbstractDict{String,<:Any}=Dict{String,Any}())\n\nRender the molecule (a Chemfiles frame). If chemviewer_id is not given, a new electron window will be created. Additional options for rendering can be provided. Returns the id of the current chemviewer javascript object.\n\n\n\n\n\n","category":"method"},{"location":"reference/#ChemfilesViewer.save_image-Tuple{AbstractString}","page":"Reference","title":"ChemfilesViewer.save_image","text":"function save_image(filename::AbstractString; chemviewer_id::String=\"\")\n\nSave a png image of the render to filename. The image size is specified by the parameters renderWidth and renderHeight, which can be set by set_options. If the chemviewer_id is not specified, the most recent instance is used. \n\n\n\n\n\n","category":"method"},{"location":"reference/#ChemfilesViewer.set_camera_position","page":"Reference","title":"ChemfilesViewer.set_camera_position","text":"function set_camera_position(axis::String=\"z\", direction::String=\"+\"; chemviewer_id::String=\"\")\n\nSet the camera position to be along one of the axis x, y, z or the unit cell vectors a, b, c. The direction of + or - specifies in which direction the camera is moved. If the chemviewer_id is not specified, the most recent instance is used. \n\n\n\n\n\n","category":"function"},{"location":"reference/#ChemfilesViewer.set_options-Tuple{AbstractDict{String, var\"#s14\"} where var\"#s14\"}","page":"Reference","title":"ChemfilesViewer.set_options","text":"function set_options(options::AbstractDict{String,<:Any}; chemviewer_id::String=\"\")\n\nSet options for the render. Available options are: \n\nshader: basic, phong, lambert (default)  \ndrawingType: ball and stick (default), space filling, wireframe  \ncameraType: perspective (default), orthographic  \nquality: high (default), low  \nshowUnitCell: true (default), false  \nshowLabels: true, false (default)  \ncameraFov: field of view of the perspective camera, default is 40  \ncameraDistance: distance of the perspective camera, will be automatically calculated if left at 0  \ncameraAxis: set the camera view along this axis (x, y, z (default) or the unit cell vectors a, b, c), see also set_camera_position  \ncameraAxisDirection: direction of the camera along cameraAxis: + (default), -  \nhemisphereLightIntensity: light intensity of hemiphere light, defaults to 0.8  \ndirectionalLightIntensity: light intensity of directional light, defaults to 0.05  \ncenter: center of the render, will be automatically calculated if not given  \nrotateSpeed: speed of rotation via mouse control, defaults to 2  \nrenderWidth: width of the saved image, default is 1600  \nrenderHeight: height of the saved image, default is 1600\n\nIf the chemviewer_id is not specified, the most recent instance is used. \n\n\n\n\n\n","category":"method"},{"location":"","page":"Introduction","title":"Introduction","text":"CurrentModule = ChemfilesViewer","category":"page"},{"location":"#ChemfilesViewer","page":"Introduction","title":"ChemfilesViewer","text":"","category":"section"},{"location":"","page":"Introduction","title":"Introduction","text":"Documentation for ChemfilesViewer.","category":"page"},{"location":"#About","page":"Introduction","title":"About","text":"","category":"section"},{"location":"","page":"Introduction","title":"Introduction","text":"A julia library to visualize chemical molecules and other structures in the Chemfiles format.","category":"page"},{"location":"#Usage","page":"Introduction","title":"Usage","text":"","category":"section"},{"location":"","page":"Introduction","title":"Introduction","text":"# read molecule using Chemfiles\nusing Chemfiles\ntrajectory = Trajectory(\"mol.sdf\")\nmol = read(trajectory)\n\n# render molecule\nviewer_id = render_molecule(mol)\nviewer_id = render_molecule(mol, chemviewer_id=viewer_id)  # render another molecule in the same window\n\n# change properties\nd = generate_dict_molecule(mol)\nd[\"atoms\"][1][\"color\"] = \"#f00000\"\nd[\"atoms\"][1][\"label\"] = \"Important atom\"\nd[\"atoms\"][1][\"radius\"] = 1.0\nviewer_id = render_dict_molecule(d, chemviewer_id=viewer_id)\n\n# change view\nset_camera_position(\"x\", \"-\")\nset_options(Dict(\"drawingType\" => \"wireframe\"))\nset_camera_position(\"c\", \"+\")\nset_options(Dict(\"drawingType\" => \"ball and stick\"))\n\n# save image\nsave_image(\"test.png\")","category":"page"},{"location":"","page":"Introduction","title":"Introduction","text":"Use mouse to rotate, zoom and pan. Keyboard shortcuts x, y, z set the view along the x, y and z axis. Analogously, a, b, c set the view alonmg the unit cell vectors. Uppercase letters (X, Y, Z, A, B, C) set the opposite view direction.","category":"page"},{"location":"","page":"Introduction","title":"Introduction","text":"A more detailed description can be found in the Reference","category":"page"}]
}
