using ChemfilesViewer
using Images
using Test

"""
A crude way to estimate that two images are rather similar.
"""
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
    mol = load_molecule("mol.sdf")
    
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
    save_image_labels("test.png")
    @test image_diff("test.png", "test_4_labels.png")
    save_overlay("test.png", "test_4.png", "test_4_labels.png")
    @test image_diff("test.png", "test_4_both.png")

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
    save_image_labels("test.png")
    @test image_diff("test.png", "test_7_labels.png")
    
    # add label
    add_label!(Dict(
        "label" => "some other text",
        "location" => [2,5,5],
        "style" => "font-weight:bold;color:blue;font-size:3em;"
    ))
    sleep(1)
    save_image_labels("test.png")
    @test image_diff("test.png", "test_8_labels.png")

    # clear labels
    clear_labels!()
    sleep(1)
    save_image_labels("test.png")
    @test image_diff("test.png", "test_9_labels.png")

    # save image again
    if isfile("test.png")
        rm("test.png")
    end
    save_image("test.png")

    close(ChemfilesViewer.get_reference(viewer_id)[1])
    
    @test filesize("test.png") > 10000

    img = rand(RGBA, 10, 10)
    faded_img = fadeout_img(img, 0.08)
    @test size(faded_img) == size(img)
    for c in (:r, :g, :b)
        @test getfield.(faded_img, c) == getfield.(img, c)
    end
    @test all(getfield.(faded_img, :alpha) .<= getfield.(img, :alpha))

    img = load("test.png")
    faded_img = fadeout_img("test.png", 0.15)
    for c in (:r, :g, :b)
        @test getfield.(faded_img, c) == getfield.(img, c)
    end
    @test all(getfield.(faded_img, :alpha) .<= getfield.(img, :alpha))

    img = fill(RGBA(0.2, 0.4, 0.5), 100, 100)
    faded_img = fadeout_img(img, 0.15)
    @test size(faded_img) == size(img)
    for c in (:r, :g, :b)
        @test getfield.(faded_img, c) == getfield.(img, c)
    end
    @test all(getfield.(faded_img, :alpha) .<= getfield.(img, :alpha))

    @test all(getfield.(faded_img[1,:], :alpha) .== 0.0)
    @test all(getfield.(faded_img[:,1], :alpha) .== 0.0)
    @test all(getfield.(faded_img[end,:], :alpha) .== 0.0)
    @test all(getfield.(faded_img[:,end], :alpha) .== 0.0)
    
    @test all(getfield.(faded_img[2,:], :alpha) .< 0.1)
    @test all(getfield.(faded_img[:,2], :alpha) .< 0.1)
    @test all(getfield.(faded_img[end-1,:], :alpha) .< 0.1)
    @test all(getfield.(faded_img[:,end-1], :alpha) .< 0.1)

    @test all(getfield.(faded_img[15:85,15:85], :alpha) .== 1.0)
    @test all(getfield.(faded_img[1:14,:], :alpha) .< 1.0)
    @test all(getfield.(faded_img[86:end,:], :alpha) .< 1.0)
    @test all(getfield.(faded_img[:,86:end], :alpha) .< 1.0)
end
