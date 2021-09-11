using ChemfilesViewer
using Documenter

DocMeta.setdocmeta!(ChemfilesViewer, :DocTestSetup, :(using ChemfilesViewer); recursive=true)

makedocs(;
    modules=[ChemfilesViewer],
    authors="Alex Riss <00alexx@riss.at>",
    repo="https://github.com/alexriss/ChemfilesViewer.jl",
    sitename="ChemfilesViewer.jl",
    format=Documenter.HTML(;
        prettyurls=get(ENV, "CI", "false") == "true",
        canonical="https://alexriss.github.io/ChemfilesViewer.jl",
        assets=String[],
    ),
    pages=[
        "Home" => "index.md",
    ],
)

deploydocs(;
    repo="github.com/alexriss/ChemfilesViewer.jl",
    devbranch="main",
)
