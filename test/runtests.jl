using ChemfilesViewer
using Chemfiles
using Test

@testset "ChemfilesViewer" begin
    trajectory = Trajectory("mol.sdf")
    mol = read(trajectory)
    
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
    
    # change view
    set_camera_position!("x", "-")
    set_options!(Dict("drawingType" => "wireframe"))
    set_camera_position!("c", "+")
    set_options!(Dict("drawingType" => "ball and stick"))
    
    # save image
    if isfile("test.png")
        rm("test.png")
    end
    save_image("test.png")

    close(ChemfilesViewer.get_reference(viewer_id)[1])
    
    @test filesize("test.png") > 100000
end
