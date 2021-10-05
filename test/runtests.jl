using ChemfilesViewer
using Chemfiles
using Images
using Test

function image_diff(fname1, fname2)
    img1 = load(fname1)
    img2 = load(fname2)
    if (size(img1) != size(img2))
        @warn "Image output size is not correct: $(size(img1)) instead of $(size(img2))."
    end
    img1 = imresize(img1, size(img2))
    diff = sum(abs.(img1 .- img2))
    diff_rgb =  diff.r + diff.g + diff.b
    if (diff_rgb < 20e3)
        return true
    else
        @warn "Generated image deviates by a value of $(diff_rgb)."
        return false
    end
end

@testset "ChemfilesViewer" begin
    trajectory = Trajectory("mol.sdf")
    mol = read(trajectory)
    
    # render molecule
    render_molecule(mol, options=Dict("renderWidth" => 640, "renderHeight" => 640))
    sleep(1)
    save_image("test.png")
    @test image_diff("test.png", "test_1.png")
    # render another molecule in the same window
    render_molecule!(mol, options=Dict("cameraType"=>"orthographic"))
    sleep(1)
    save_image("test.png")
    @test image_diff("test.png", "test_2.png")

    # save reference to last used output
    viewer_id = get_current_chemviewer_id()
    
    # change properties
    d = generate_dict_molecule(mol)
    d["atoms"][1]["color"] = "#f00000"
    d["atoms"][1]["label"] = "Important atom"
    d["atoms"][1]["radius"] = 1.0
    render_dict_molecule(d, chemviewer_id=viewer_id)
    sleep(1)
    save_image("test.png")
    @test image_diff("test.png", "test_3.png")

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
    sleep(1)
    save_image("test.png")
    @test image_diff("test.png", "test_4.png")
    
    # change view
    set_camera_position!("x", "-")
    set_options!(Dict("drawingType" => "wireframe"))
    sleep(1)
    save_image("test.png")
    @test image_diff("test.png", "test_5.png")

    set_camera_position!("c", "+")
    set_options!(Dict("drawingType" => "ball and stick"))
    sleep(1)
    save_image("test.png")
    @test image_diff("test.png", "test_6.png")

    # change style
    set_options!(Dict("styles" => Dict(
        "H" => Dict("color" => "#c0c0c0", "radius" => 0.4),
        "N" => Dict("color" => "#241571"),
        "bond" => Dict("color" => "#ffffff", "radius" => 0.3)
    )))
    sleep(1)
    save_image("test.png")
    @test image_diff("test.png", "test_7.png")

    
    # save image
    if isfile("test.png")
        rm("test.png")
    end
    save_image("test.png")

    close(ChemfilesViewer.get_reference(viewer_id)[1])
    
    @test filesize("test.png") > 10000
end
