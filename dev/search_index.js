var documenterSearchIndex = {"docs":
[{"location":"","page":"Home","title":"Home","text":"CurrentModule = ChemfilesViewer","category":"page"},{"location":"#ChemfilesViewer","page":"Home","title":"ChemfilesViewer","text":"","category":"section"},{"location":"","page":"Home","title":"Home","text":"Documentation for ChemfilesViewer.","category":"page"},{"location":"","page":"Home","title":"Home","text":"","category":"page"},{"location":"","page":"Home","title":"Home","text":"Modules = [ChemfilesViewer]","category":"page"},{"location":"#ChemfilesViewer.generate_dict_molecule-Tuple{Chemfiles.Frame}","page":"Home","title":"ChemfilesViewer.generate_dict_molecule","text":"generate_dict_molecule(molecule::Chemfiles.Frame)\n\nGenerate a dictionary for the molecule specifying the atoms, bonds and unit cell.\n\n\n\n\n\n","category":"method"},{"location":"#ChemfilesViewer.get_window_chemviewer_id-Tuple{Union{Nothing, Blink.AtomShell.Window}, String}","page":"Home","title":"ChemfilesViewer.get_window_chemviewer_id","text":"get_window_chemviewer_id(window::Union{Blink.Window,Nothing}, chemviewer_id::String)\n\nHelper function to get the most recent window and chemviewer_id parameters. \n\n\n\n\n\n","category":"method"},{"location":"#ChemfilesViewer.render_dict_molecule-Tuple{AbstractDict{String, var\"#s13\"} where var\"#s13\"}","page":"Home","title":"ChemfilesViewer.render_dict_molecule","text":"render_dict_molecule(dict_molecule::AbstractDict{String,<:Any}; window::Union{Blink.Window,Nothing}=nothing, options::AbstractDict{String,<:Any}=Dict{String,Any}())\n\nRender the molecule from a dictionary containing the atoms, bonds and unit cell. If window is given, this window will be reused. Additional options for rendering can be provided. Returns the current window instance and the id of the chemviewer javascript object.\n\n\n\n\n\n","category":"method"},{"location":"#ChemfilesViewer.render_molecule-Tuple{Chemfiles.Frame}","page":"Home","title":"ChemfilesViewer.render_molecule","text":"render_molecule(molecule::Chemfiles.Frame; window::Union{Blink.Window,Nothing}=nothing, options::AbstractDict{String,<:Any}=Dict{String,Any}())\n\nRender the molecule (a Chemfiles frame). If window is not given, a new electron window will be created. Additional options for rendering can be provided. Returns the current window instance and the id of the chemviewer javascript object.\n\n\n\n\n\n","category":"method"},{"location":"#ChemfilesViewer.save_image-Tuple{AbstractString}","page":"Home","title":"ChemfilesViewer.save_image","text":"save_image(filename::AbstractString; window::Union{Blink.Window,Nothing}=nothing, chemviewer_id::String=\"\")\n\nSave a png image of the render to filename. The image size is specified by the parameters renderWidth and renderHeight, which can be set by set_options. If the window and chemviewer_id are not specified, the most recent parameters are used.\n\n\n\n\n\n","category":"method"},{"location":"#ChemfilesViewer.set_camera_position","page":"Home","title":"ChemfilesViewer.set_camera_position","text":"set_camera_position(axis::String=\"z\", direction::String=\"+\"; window::Union{Blink.Window,Nothing}=nothing, chemviewer_id::String=\"\")\n\nSet the camera position to be along one of the axis x, y, z or the unit cell vectors a, b, c. The direction of + or - specifies in which direction the camera is moved. If the window and chemviewer_id are not specified, the most recent parameters are used. \n\n\n\n\n\n","category":"function"},{"location":"#ChemfilesViewer.set_options-Tuple{AbstractDict{String, var\"#s13\"} where var\"#s13\"}","page":"Home","title":"ChemfilesViewer.set_options","text":"set_options(options::AbstractDict{String,<:Any}; window::Union{Blink.Window,Nothing}=nothing, chemviewer_id::String=\"\")\n\nSet options for the render. Available options are: \n\nshader: basic, phong, lambert (default)  \ndrawingType: ball and stick (default), space filling, wireframe  \ncameraType: perspective (default), orthographic  \nquality: high (default), low  \nshowUnitCell: true (default), false  \nshowLabels: true, false (default)  \ncameraFov: field of view of the perspective camera, default is 40  \ncameraDistance: distance of the perspective camera, will be automatically calculated if left at 0  \ncameraAxis: set the camera view along this axis (x, y, z (default) or the unit cell vectors a, b, c), see also set_camera_position  \ncameraAxisDirection: direction of the camera along cameraAxis: + (default), -  \nhemisphereLightIntensity: light intensity of hemiphere light, defaults to 0.8  \ndirectionalLightIntensity: light intensity of directional light, defaults to 0.05  \ncenter: center of the render, will be automatically calculated if not given  \nrotateSpeed: speed of rotation via mouse control, defaults to 2  \nrenderWidth: width of the saved image, default is 1600  \nrenderHeight: height of the saved image, default is 1600\n\nIf the window and chemviewer_id are not specified, the most recent parameters are used. \n\n\n\n\n\n","category":"method"}]
}
