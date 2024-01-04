// molecular 3d viewer using three.js
// based on and inspired by Patrick Fuller's imolecule (https://github.com/patrickfuller/imolecule; MIT LIcense)
//
// Alex Riss, 2021
//


import {
    WebGLRenderer, PerspectiveCamera, OrthographicCamera,
    Scene, HemisphereLight, DirectionalLight,
    Mesh, SphereGeometry, CylinderGeometry,
    MeshBasicMaterial, MeshPhongMaterial, MeshLambertMaterial,
    LineBasicMaterial, BufferGeometry, Line,
    Vector3, Matrix4, Euler,
} from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
// import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CSS3DRenderer, CSS3DSprite } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import domtoimage from 'dom-to-image';

function ChemViewer() {
    //
}


// Creates a new instance of imolecule
ChemViewer.prototype.create = function (selector, id, options) {
    this.optionDefaults = {
        "shader": "lambert",
        "drawingType": "ball and stick",
        "cameraType": "perspective",
        "quality": "high",
        "showUnitCell": true,
        "showLabels": false,
        "styles": {},
        "cameraFov": 40,
        "cameraDistance": 0,
        "cameraZoom": 1,
        "cameraAxis": "z",
        "cameraAxisDirection": "+",
        "hemisphereLightIntensity": 1.0,
        "directionalLightIntensity": 0.05,
        "center": [],
        "rotateSpeed": 2,
        "renderWidth": 1600,
        "renderHeight": 1600
    }

    var s = document.querySelector(selector + "_" + id), self = this, hasWebgl;
    options = options || {};
    this.s = s;

    this.id = id;

    this.setOptions(options, true);
    this.data = JSON.parse(JSON.stringify(this.defaultStyles));  // deep copy
    this.setStyles(this.styles);

    this.saveImage = false;
    this.linkSave = document.createElement('a');
    this.linkSaveLabels = document.createElement('a');
    this.saving = false;
    this.prepareSaveParams = {};

    hasWebgl = (function () {
        try {
            return !!window.WebGLRenderingContext &&
                !!document.createElement('canvas').getContext('experimental-webgl');
        } catch (e) {
            return false;
        }
    }());

    if (hasWebgl) {
        this.renderMode = 'webgl';
        this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } else {
        s.innerHTML = s.innerHTML + '<p class="alert alert-danger" align="center">Your web browser ' +
            'does not seem to support WebGL. Please upgrade.</p>';
        return;
    }
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(s.clientWidth, s.clientHeight);
    s.appendChild(this.renderer.domElement);

    // for labels
    this.labelRenderer = new CSS3DRenderer();
    this.labelRenderer.setSize(s.clientWidth, s.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    s.appendChild(this.labelRenderer.domElement);

    this.perspective = new PerspectiveCamera(this.cameraFov, s.clientWidth / s.clientHeight);
    this.orthographic = new OrthographicCamera(-s.clientWidth / 32,
        s.clientWidth / 32, s.clientHeight / 32, -s.clientHeight / 32, -100, 1000);
    this.orthographic.z = 10;

    this.light = new HemisphereLight(0xffffff, 0x505050, this.hemisphereLightIntensity);
    this.directionalLight = new DirectionalLight(0xffffff, this.directionalLightIntensity);
    this.directionalLight.position.set(0, 0, 1);
    this.directionalLight.target.position.set(0,0,0);

    this,this.makeGeometries();
    this.atoms = [];
    this.bonds = [];
    this.corners = undefined;
    this.standaloneLabels = [];

    // Initializes a scene and appends objects to be drawn
    this.scene = new Scene();
    this.scene.add(this.perspective);
    this.scene.add(this.orthographic);
    this.scene.add(this.directionalLight.target);  // we need this in the scene so that the tartget gets updated oin camera movement

    this.updateCamera = (this.cameraType === 'orthographic');  // everything is sitll created in perspective-type and afterwards updated
    this.setCameraType('perspective');
    this.makeMaterials();

    this.setupEvents();

    this.render();
    this.animate();
}


// gets element with the right id
ChemViewer.prototype.getElementById = function (el) {
    return document.getElementById(el + "_" + this.id);
}

// create default geometries
ChemViewer.prototype.makeGeometries = function () {
    var widthSegments, heightSegments, radialSegments, heightSegments2,

    widthSegments = (this.quality === "high") ? 64 : 16;
    heightSegments = (this.quality === "high") ? 48 : 12;
    radialSegments = (this.quality === "high") ? 48 : 6;
    heightSegments2 = (this.quality === "high") ? 16 : 3;
    this.sphereGeometry = new SphereGeometry(1, widthSegments, heightSegments);
    this.cylinderGeometry = new CylinderGeometry(1, 1, 1, radialSegments, heightSegments2, false);
    // This orients the cylinder primitive so THREE.lookAt() works properly
    this.cylinderGeometry.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(Math.PI / 2, Math.PI, 0)));
}

// initializes or updates options
ChemViewer.prototype.setOptions = function (options, initialize=false) {
    var self = this, redraw = false;
    options = options || {};

    if (initialize) {
        Object.entries(this.optionDefaults).forEach(([key, defaultValue]) => {
            self[key] = options.hasOwnProperty(key) ? options[key] : defaultValue;
        });
    } else {
        if (Object.keys(options).length == 0) {  // set current values for all options
            Object.entries(this.optionDefaults).forEach(([key, defaultValue]) => {
                options[key] = self[key];
            });
        } else {
            Object.entries(this.optionDefaults).forEach(([key, defaultValue]) => {
                if (!options.hasOwnProperty(key)) {
                    if (key != "cameraAxis") {  // cameraAxis is special because its state is not clearly defined (but when given, we will set the camera position accordingly)
                        options[key] = self[key];
                    }
                }
            });
        }

        if (this.center != options.center) {
            this.center = options.center;
            if (this.center.length != 3) {
                this.center = [...this.centerOriginal];
            }
            this.controls.target.set( ...this.center ); // pivot point
        }
        if (this.shader != options.shader) {
            this.setShader(options.shader);
        }
        if (this.drawingType != options.drawingType) {
            this.setDrawingType(options.drawingType);
        }
        if (this.cameraType != options.cameraType) {
            this.setCameraType(options.cameraType);
        }
        if (this.showUnitCell != options.showUnitCell) {
            this.toggleUnitCell(options.showUnitCell);
        }
        if (this.showLabels != options.showLabels) {
            this.toggleLabels(options.showLabels);
        }
        if (this.cameraFov != options.cameraFov) {
            this.cameraFov = options.cameraFov;
            this.perspective.fov = this.cameraFov;
            this.perspective.updateProjectionMatrix();
        }
        if (this.cameraDistance != options.cameraDistance) {
            this.cameraDistance = options.cameraDistance;
            if (this.cameraDistance == 0) {
                this.cameraDistance = this.cameraDistanceOriginal;
            }
        }
        if (this.cameraZoom != options.cameraZoom) {
            this.cameraZoom = options.cameraZoom;
            this.camera.zoom = this.cameraZoom;
            this.camera.updateProjectionMatrix();
        }
        if (options.hasOwnProperty("cameraAxis")) {
            this.cameraAxis = options.cameraAxis;
            if (options.hasOwnProperty("cameraAxisDirection")) {
                this.cameraAxisDirection = options.cameraAxisDirection;
            }
            this.positionCamera(this.cameraAxis, this.cameraAxisDirection)
        }
        if (this.hemisphereLightIntensity != options.hemisphereLightIntensity) {
            this.hemisphereLightIntensity = options.hemisphereLightIntensity;
            this.light.intensity = this.hemisphereLightIntensity;
        }
        if (this.directionalLightIntensity != options.directionalLightIntensity) {
            this.directionalLightIntensity = options.directionalLightIntensity;
            this.directionalLight.intensity = this.directionalLightIntensity;
        }
        if (this.rotateSpeed != options.rotateSpeed) {
            this.rotateSpeed = options.rotateSpeed;
            this.controls.rotateSpeed = this.rotateSpeed;
        }
        if (this.renderWidth != options.renderWidth) {
            this.renderWidth = options.renderWidth;
        }
        if (this.renderHeight != options.renderHeight) {
            this.renderHeight = options.renderHeight;
        }
        if (Object.keys(options.styles).length > 0) {  // we don't check, we will always redraw if this is given
            this.setStyles(options.styles);
            redraw = true;
        }
        if (this.quality != options.quality) {
            this.quality = options.quality;
            this.makeGeometries();
            redraw = true;
        }    
        if (redraw) {
            this.setShader(this.shader);  // redraw
        }
    }
}


// sets value in dropdown
ChemViewer.prototype.setSelect = function (el, value) {
    var idx = 0;
    for (let i=0; i<el.options.length; i++){
      if (el.options[i].value == value){
        idx = i;
        break;
      }
    }
    el.selectedIndex = idx;
    return el.value
}

// sets up GUI events
ChemViewer.prototype.setupEvents = function () {
    var self = this;

    window.addEventListener('resize', function (e) {
        self.renderer.setSize(self.s.clientWidth, self.s.clientHeight);
        self.labelRenderer.setSize(self.s.clientWidth, self.s.clientHeight);
        self.perspective.aspect = self.s.clientWidth / self.s.clientHeight;
        self.perspective.updateProjectionMatrix();
        self.orthographic.left = -self.s.clientWidth / 32.0;
        self.orthographic.right = self.s.clientWidth / 32.0;
        self.orthographic.top = self.s.clientHeight / 32.0;
        self.orthographic.bottom = -self.s.clientHeight / 32.0;
        self.orthographic.updateProjectionMatrix();

        self.render();
    });

    this.getElementById('chemviewer_drawingtype').value = this.drawingType;
    this.getElementById('chemviewer_drawingtype').addEventListener('change', function (e) {
        self.setDrawingType(e.target.value);
    });
    this.getElementById('chemviewer_cameratype').value = this.cameraType;
    this.getElementById('chemviewer_cameratype').addEventListener('change', function (e) {
        self.setCameraType(e.target.value);
    });
    this.getElementById('chemviewer_shader').value = this.shader;
    this.getElementById('chemviewer_shader').addEventListener('change', function (e) {
        self.setShader(e.target.value);
    });
    this.getElementById('chemviewer_unitcell').checked = this.showUnitCell;
    this.getElementById('chemviewer_unitcell').addEventListener('change', function (e) {
        self.toggleUnitCell(e.target.checked);
    });
    this.getElementById('chemviewer_labels').checked = this.showLabels;
    this.getElementById('chemviewer_labels').addEventListener('change', function (e) {
        self.toggleLabels(e.target.checked);
    });
    this.getElementById('chemviewer_reset').addEventListener('click', function (e) {
        self.setOptions();
    });
    this.getElementById('chemviewer_save').addEventListener('click', function (e) {
        self.save(true);
    });

    // keyboard shortcuts
    this.getElementById('chemviewer_main').tabIndex = 0; // this seems to be needed to detect keyboard events
    this.getElementById('chemviewer_main').addEventListener('keydown', (e) => {
        switch(e.key) {
            case "x":
                self.positionCamera("x");
                break;
            case "y":
                self.positionCamera("y");
                break;
            case "z":
                self.positionCamera("z");
                break;
            case "X":
                self.positionCamera("x", "-");
                break;
            case "Y":
                self.positionCamera("y", "-");
                break;
            case "Z":
                self.positionCamera("z", "-");
                break;
            case "a":
                self.positionCamera("a");
                break;
            case "b":
                self.positionCamera("b");
                break;
            case "c":
                self.positionCamera("c");
                break;
            case "A":
                self.positionCamera("a", "-");
                break;
            case "B":
                self.positionCamera("b", "-");
                break;
            case "C":
                self.positionCamera("c", "-");
                break;
            default:
                //
        }
    });
}

// Makes materials according to specified shader
ChemViewer.prototype.makeMaterials = function () {
    var self = this, threeMaterial;

    // If a different shader is specified, use uncustomized materials
    if (['basic', 'phong', 'lambert'].includes(self.shader)) {
        for (const [key, value] of Object.entries(self.data)) {
            if (self.shader === 'phong') { 
                threeMaterial = MeshPhongMaterial;
            } else if (self.shader === 'lambert') {
                threeMaterial = MeshLambertMaterial;
            } else {
                threeMaterial = MeshBasicMaterial;
            }
            value.material = new threeMaterial({ color: value.color });
        }
    } else {
        throw new Error(this.shader + " shader does not exist. Use " +
            "'basic', 'phong', or 'lambert'.");
    }
}

// Draws a molecule.
ChemViewer.prototype.draw = function (molecule, resetCamera=true) {
    var mesh, self, a, scale, j, k, dy, cent, data, v, vectors, points, r,
        trans, geometry, material, atomColor, minXYZ, maxXYZ, maxDist;
    self = this;
    cent = new Vector3();
    self.current = molecule;

    scale = self.drawingType === 'space filling' ? 1.0 : 0.3;

    // Don't hate on formats without bond information
    if (!molecule.hasOwnProperty('bonds')) { molecule.bonds = []; }

    // Draws atoms and saves references
    maxXYZ = [molecule.atoms[0].location[0], molecule.atoms[0].location[1], molecule.atoms[0].location[2]];
    minXYZ = [molecule.atoms[0].location[0], molecule.atoms[0].location[1], molecule.atoms[0].location[2]];
    for (const [i, atom] of molecule.atoms.entries()) {
        data = self.data[atom.element] || self.data.unknown;
        atomColor = data.color;  // for labels
        mesh = new Mesh(self.sphereGeometry, data.material);
        mesh.position.fromArray(atom.location);
        
        if (atom.hasOwnProperty('radius')) {
            r = atom.radius;
        } else {
            r = data.radius;
        }
        mesh.scale.set(1, 1, 1).multiplyScalar(scale * r * 2);

        if (atom.hasOwnProperty('color')) {
            mesh.material = mesh.material.clone();
            mesh.material.color.set(atom.color);
            atomColor = atom.color;  // for labels
        }

        if (atom.hasOwnProperty('label')) {
            let labelDiv = document.createElement( 'div' );
            labelDiv.className = 'chemviewer_label';
            labelDiv.classList.add('chemviewer_atom_label');
            labelDiv.textContent = atom.label;
            labelDiv.style.color = '#' + atomColor.toString(16);
            if (!self.showLabels) {
                labelDiv.classList.add("hidden");
            }
            let atomLabel = new CSS3DSprite( labelDiv );
            atomLabel.position.set( 0, 0, 0 );
            atomLabel.scale.set(0.03,0.03,0.03);
            mesh.add( atomLabel );
        }

        if (self.drawingType === 'wireframe') {
            mesh.visible = false;  // we need the object for the labels, but just set it to invisible
        }
        self.scene.add(mesh);
        mesh.element = atom.element;
        self.atoms.push(mesh);

        for (let ii=0; ii<3; ii++) {
            maxXYZ[ii] = Math.max(maxXYZ[ii], atom.location[ii])
            minXYZ[ii] = Math.min(minXYZ[ii], atom.location[ii])
        }
    }

    // labels
    if (molecule.hasOwnProperty('labels')) {
        for (const [i, label] of molecule.labels.entries()) {
            self.addStandaloneLabel(label);
        }
    }

    // Sets camera position to view whole molecule in bounds with some buffer
    if (resetCamera) {
        self.controls.reset();

        if (self.center.length != 3) {
            self.center = [0, 0, 0]
            for (let ii=0; ii<3; ii++) {
                self.center[ii] = (minXYZ[ii] + maxXYZ[ii]) / 2
            }
        }
        self.centerOriginal = [...self.center];

        if (self.cameraDistance == 0) {
            maxDist = 0;
            for (let ii=0; ii<3; ii++) {
                maxDist = Math.max(maxDist, maxXYZ[ii] - self.center[ii])
            }
            self.cameraDistance = (maxDist / Math.tan(Math.PI * self.camera.fov / 360) + Math.max(...maxXYZ)) / 0.9;
        }
        self.cameraDistanceOriginal = self.cameraDistance;

        self.positionCamera(self.cameraAxis, self.cameraAxisDirection);
    }

    // Bonds require some basic vector math
    for (const [i, bond] of molecule.bonds.entries()) {
        a = [self.atoms[bond.atoms[0]], self.atoms[bond.atoms[1]]];
        for (j = 0; j < bond.order; j += 1) {
            if (bond.order === 2) {
                dy = 0.5 * ((j === 1) ? 1 : -1);
            } else if (bond.order === 3 && j !== 0) {
                dy = ((j === 1) ? 1 : -1);
            } else {
                dy = 0;
            }

            for (k = 0; k < 2; k += 1) {
                mesh = new Mesh(self.cylinderGeometry, self.data.bond.material.clone());
                cent.addVectors(a[0].position, a[1].position).divideScalar(2);
                if (self.data[a[k].element] === undefined) {
                    mesh.atomMaterial = self.data.unknown.material;
                }
                else {
                    mesh.atomMaterial = self.data[a[k].element].material;
                }
                mesh.position.addVectors(cent, a[k].position).divideScalar(2);
                mesh.lookAt(a[1].position);

                if (bond.hasOwnProperty('radius')) {
                    r = bond.radius;
                } else {
                    r = self.data.bond.radius;
                }

                mesh.scale.x = mesh.scale.y = 0.3 * r * 2;
                mesh.scale.z = a[1].position.distanceTo(a[0].position) / 2.0;
                mesh.translateY(0.3 * dy);

                if (self.drawingType === 'wireframe') {
                    mesh.material = mesh.atomMaterial;
                }

                if (bond.hasOwnProperty('color')) {
                    mesh.material = mesh.material.clone();
                    mesh.material.color.set(bond.color);
                }

                if (self.drawingType !== 'space filling') {
                    self.scene.add(mesh);
                }
                self.bonds.push(mesh);
            }
        }
    }

    // initialize as XYZ
    self.unitcell = [
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 0, 1)
    ]

    if (molecule.hasOwnProperty('unitcell') && molecule.unitcell.length == 3) {
        v = new Vector3(0, 0, 0);
        self.unitcell = [
            v.clone().fromArray(molecule.unitcell[0]),
            v.clone().fromArray(molecule.unitcell[1]),
            v.clone().fromArray(molecule.unitcell[2])
        ];
    }

    // If we're dealing with a crystal structure, draw the unit cell
    if (molecule.hasOwnProperty('unitcell') && molecule.unitcell.length == 3) {
        // Some basic conversions to handle math via THREE.Vector3
        v = new Vector3(0, 0, 0);
        vectors = self.unitcell;
        // The eight corners of the unit cell are linear combinations of above
        points = [
            v.clone(), vectors[0].clone(), vectors[1].clone(), vectors[2].clone(),
            v.clone().add(vectors[0]).add(vectors[1]).add(vectors[2]),
            v.clone().add(vectors[1]).add(vectors[2]),
            v.clone().add(vectors[0]).add(vectors[2]),
            v.clone().add(vectors[0]).add(vectors[1])
        ];
        // Translate unit cell to center
        trans = new Vector3( ...this.center ).sub(points[4].clone().multiplyScalar(0.5));  // center half unit cell
        for (j = 0; j < points.length; j += 1) {
            points[j].add(trans);
        }
        // Draw the box line-by-line
        const geometryPoints = [];
        for (const [index, value] of [0, 1, 0, 2, 0, 3, 6, 1, 7, 2, 5, 3, 5, 4, 6, 4, 7].entries()) {
            geometryPoints.push(points[value]);
        }
        geometry = new BufferGeometry().setFromPoints( geometryPoints );
        material = new LineBasicMaterial({ color: 0x000000, linewidth: 3 });

        self.corners = new Line(geometry, material);
        if (self.showUnitCell) {
            self.scene.add(self.corners);
        }
    }

    if (molecule.hasOwnProperty('unitcell') && molecule.unitcell.length == 3) {
        self.getElementById('chemviewer_unitcell').disabled = false;
        self.getElementById('chemviewer_unitcell').checked = self.showUnitCell;
        self.getElementById('chemviewer_unitcell_label').classList.remove("disabled");
    } else {
        self.getElementById('chemviewer_unitcell').disabled = true;
        self.getElementById('chemviewer_unitcell').checked = false;
        self.getElementById('chemviewer_unitcell_label').classList.add("disabled");
    }

    // If drawing in orthographic, controls need to be initialized *after*
    // building the molecule. This should be triggered at most once, and only
    // when imolecule.create($d, {cameraType: 'orthographic'}) is used.
    if (self.updateCamera) {
        self.setCameraType('orthographic');
        self.updateCamera = false;
    }
    self.render();
}


// adds standalone label
ChemViewer.prototype.addStandaloneLabel = function (label) {
    let labelDiv = document.createElement( 'div' );
    labelDiv.className = 'chemviewer_label';
    labelDiv.classList.add('chemviewer_standalone_label');
    labelDiv.textContent = label.label;
    if (label.hasOwnProperty("style")) {
        labelDiv.style.cssText = label.style;
    }
    if (label.hasOwnProperty("color")) {
        labelDiv.style.color = label.color;
    }
    if (!this.showLabels) {
        labelDiv.classList.add("hidden");
    }
    if (!label.hasOwnProperty("location")) {
        label.location = [0,0,0];
    }
    let standaloneLabel = new CSS3DSprite( labelDiv );
    standaloneLabel.scale.set(0.03,0.03,0.03);
    standaloneLabel.position.fromArray(label.location);
    this.scene.add( standaloneLabel );
    this.standaloneLabels.push(standaloneLabel);
}

// clears all standalone labels
ChemViewer.prototype.clearStandaloneLabels = function () {
    for (const [i, value] of this.standaloneLabels.entries()) {
        this.scene.remove(value);
    }
    this.standaloneLabels = [];
    this.s.querySelectorAll(".chemviewer_standalone_label").forEach(e => e.parentNode.removeChild(e));
}

// Deletes any existing molecules.
ChemViewer.prototype.clear = function () {
    var self = this;
    for (const [i, value] of this.atoms.concat(this.bonds).entries()) {
        self.scene.remove(value);
    }
    this.atoms = [];
    this.bonds = [];
    if (this.corners != undefined) {
        this.scene.remove(this.corners);
    }

    this.clearStandaloneLabels();

    // remove all labels
    this.s.querySelectorAll(".chemviewer_label").forEach(e => e.parentNode.removeChild(e));
}

// Loads json and draws a molecule.
ChemViewer.prototype.drawJsonFile = function (jsonFile) {
    fetch(jsonFile)
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        })
        .then(json => {
            this.clear();
            this.draw(json);
        })
        .catch(function (e) {
            console.log(e);
        })
}


// Request to save a screenshot of the current canvas
ChemViewer.prototype.save = async function (downloadImage = false) {
    this.saveImage = true;
    this.linkSave.href = "";

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    for (let i = 0; i < 50; i++) {
        if (this.saveImage === true) {  // will be set to false after saving the image
            await sleep(50);
        } else {
            break;
        }
    }
    if (downloadImage) {
        this.linkSave.click();
    }
    return this.linkSave.href;
}

// Request to save a screenshot of the labels rendering
ChemViewer.prototype.saveLabels = async function (downloadImage = false) {
    this.saveImageLabelsDownload = this.saveImageLabels = true;
    this.saveImageLabels = true;
    this.linkSaveLabels.href = "";

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    for (let i = 0; i < 50; i++) {
        if (this.saveImageLabels === true) {  // will be set to false after saving the image
            await sleep(50);
        } else {
            break;
        }
    }
    if (downloadImage) {
        this.linkSaveLabels.click();
    }
    return this.linkSaveLabels.href;
}

// Sets molecule drawing types ( ball and stick, space filling, wireframe )
ChemViewer.prototype.setDrawingType = function (type) {
    // Some case-by-case logic to avoid clearing and redrawing the canvas
    var i;
    type = this.setSelect(this.getElementById("chemviewer_drawingtype"), type);
    if (this.drawingType === 'ball and stick') {
        if (type === 'wireframe') {
            for (i = 0; i < this.atoms.length; i += 1) {
                this.atoms[i].visible = false;  // we need the object for the labels, but just set it to invisible
            }
            for (i = 0; i < this.bonds.length; i += 1) {
                this.bonds[i].material = this.bonds[i].atomMaterial;
            }
        } else if (type === 'space filling') {
            for (i = 0; i < this.atoms.length; i += 1) {
                this.atoms[i].scale.divideScalar(0.3);
            }
            for (i = 0; i < this.bonds.length; i += 1) {
                this.scene.remove(this.bonds[i]);
            }
        }
    } else if (this.drawingType === 'wireframe') {
        if (type === 'ball and stick') {
            for (i = 0; i < this.atoms.length; i += 1) {
                this.atoms[i].visible = true;
            }
            for (i = 0; i < this.bonds.length; i += 1) {
                this.bonds[i].material = this.data.bond.material;
            }
        } else if (type === 'space filling') {
            for (i = 0; i < this.atoms.length; i += 1) {
                this.atoms[i].scale.divideScalar(0.3);
                this.atoms[i].visible = true;
            }
            for (i = 0; i < this.bonds.length; i += 1) {
                this.scene.remove(this.bonds[i]);
            }
        }
    } else if (this.drawingType === 'space filling') {
        if (type === 'ball and stick') {
            for (i = 0; i < this.atoms.length; i += 1) {
                this.atoms[i].scale.multiplyScalar(0.3);
            }
            for (i = 0; i < this.bonds.length; i += 1) {
                this.bonds[i].material = this.data.bond.material;
                this.scene.add(this.bonds[i]);
            }
        } else if (type === 'wireframe') {
            for (i = 0; i < this.atoms.length; i += 1) {
                this.atoms[i].scale.multiplyScalar(0.3);
                this.atoms[i].visible = false;  // we need the object for the labels, but just set it to invisible
                // this.scene.remove(this.atoms[i]);
            }
            for (i = 0; i < this.bonds.length; i += 1) {
                this.bonds[i].material = this.bonds[i].atomMaterial;
                this.scene.add(this.bonds[i]);
            }
        }
    }
    this.drawingType = type;
    this.render();
}

// Sets camera type (orthogonal, perspective)
ChemViewer.prototype.setCameraType = function (type) {
    var self = this, cx, cy, cz, cset;

    type = this.setSelect(this.getElementById("chemviewer_cameratype"), type)

    this.cameraType = type;
    if (type === 'orthographic') {
        this.camera = this.orthographic;
        if (this.perspective.position.length() > 1) {
            this.camera.position.copy(this.perspective.position);
            this.camera.quaternion.copy(this.perspective.quaternion);
            this.camera.up.copy(this.perspective.up);
        }
    } else if (type === 'perspective') {
        this.camera = this.perspective;
        if (this.orthographic.position.length() > 1) {
            this.camera.position.copy(this.orthographic.position);
            this.camera.quaternion.copy(this.orthographic.quaternion);
            this.camera.up.copy(this.orthographic.up);
        }
    }

    cset = false;
    if (typeof this.controls != "undefined")
    {
        cx = this.controls.target.x;
        cy = this.controls.target.y;
        cz = this.controls.target.z;
        cset = true;
    }
    this.controls = new TrackballControls(this.camera, this.labelRenderer.domElement);
    if (cset) {
        this.controls.target.set(cx, cy, cz)
    }
    this.controls.rotateSpeed = this.rotateSpeed;
    this.controls.addEventListener('change', function () { self.render(); });
    this.camera.add(this.light);
    this.camera.add(this.directionalLight);
    this.render();
}

ChemViewer.prototype.positionCamera = function (axis="z", direction="+", positionDirectionalLight=true) {
    var cameraXYZ, factor, vec, vecUp;

    factor = (direction == "+") ? 1 : -1;

    cameraXYZ = new Vector3( ...this.center );
    switch(axis) {
        case "a":
            vec = this.unitcell[0].clone();
            vecUp = this.unitcell[2];
            break;
        case "b":
            vec = this.unitcell[1].clone();
            vecUp = this.unitcell[2];
            break;
        case "c":
            vec = this.unitcell[2].clone();
            vecUp = this.unitcell[1];
            break;
        case "x":
            vec = new Vector3( 1, 0, 0 );
            vecUp = new Vector3( 0, 0, 1 );
            break;
        case "y":
            vec = new Vector3( 0, 1, 0 );
            vecUp = new Vector3( 0, 0, 1 );
            break;
        default:
            vec = new Vector3( 0, 0, 1 );
            vecUp = new Vector3( 0, 1, 0 );
    }
    vec.normalize().multiplyScalar(factor * this.cameraDistance)
    cameraXYZ.add(vec);

    this.camera.position.copy(cameraXYZ);
    this.camera.up.copy(vecUp);
    this.controls.target.set( ...this.center ); // pivot point

    if (positionDirectionalLight) {
        this.directionalLight.position.copy(this.camera.position);
    }
}

// Sets shader (basic, phong, lambert) and redraws
ChemViewer.prototype.setShader = function (shader) {
    shader = this.setSelect(this.getElementById('chemviewer_shader'), shader);
    this.shader = shader;
    this.makeMaterials();
    this.clear();
    this.draw(this.current, false);
}

// prepares for saving
ChemViewer.prototype.prepareSave = function () {
    var frustumWidth, frustumHeight, frustumAspect, aspect;

    this.saving = true;

    this.prepareSaveParams.w = this.s.clientWidth;
    this.prepareSaveParams.h = this.s.clientHeight;
    this.prepareSaveParams.pixelRatio = this.renderer.getPixelRatio();
    this.prepareSaveParams.frustum = [this.orthographic.left, this.orthographic.right, this.orthographic.top, this.orthographic.bottom];
    this.prepareSaveParams.aspect = this.perspective.aspect;

    if (this.cameraType == "orthographic") {
        aspect = this.renderWidth / this.renderHeight;
        frustumWidth = this.camera.right - this.camera.left;
        frustumHeight = this.camera.top - this.camera.bottom;
        frustumAspect = frustumWidth / frustumHeight;
        if (aspect < frustumAspect) {
            this.camera.top = frustumWidth / aspect / 2;
            this.camera.bottom = -frustumWidth / aspect / 2 ;
        } else {
            this.camera.left = -frustumHeight * aspect / 2;
            this.camera.right = frustumHeight * aspect / 2;
        }
    } else {
        this.camera.aspect = this.renderWidth / this.renderHeight;
    }
    this.renderer.setPixelRatio(1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.renderWidth, this.renderHeight);
    this.labelRenderer.setSize(this.renderWidth, this.renderHeight);
    this.render();
}

//  resets parameters after saviong
ChemViewer.prototype.afterSave = function () {
    this.renderer.setPixelRatio(this.prepareSaveParams.pixelRatio);
    this.renderer.setSize(this.prepareSaveParams.w, this.prepareSaveParams.h);
    this.labelRenderer.setSize(this.prepareSaveParams.w, this.prepareSaveParams.h);

    this.orthographic.left = this.prepareSaveParams.frustum[0];
    this.orthographic.right = this.prepareSaveParams.frustum[1];
    this.orthographic.top = this.prepareSaveParams.frustum[2];
    this.orthographic.bottom = this.prepareSaveParams.frustum[3];
    this.perspective.aspect = this.prepareSaveParams.aspect;
    this.camera.updateProjectionMatrix();
    this.saving = false;
}

// Runs the main window animation in an infinite loop
ChemViewer.prototype.animate = function () {
    var self = this, options, pngBase64;
    window.requestAnimationFrame(function () {
        return self.animate();
    });
    if (this.saving) {
        return;
    } else if (this.saveImage) {
        this.prepareSave();

        pngBase64 = this.renderer.domElement.toDataURL('image/png');
        this.linkSave.download = 'chemviewer.png';
        this.linkSave.href = pngBase64;

        this.afterSave();
        this.saveImage = false;
    } else if (this.saveImageLabels) {  // dom-to-image gives us a promise, so we have to do it this way (somewhat prone to race conditions, though)
        this.prepareSave();
        
        options = {
            width: this.renderWidth,
            height: this.renderHeight
        }
        domtoimage.toPng(this.labelRenderer.domElement, options).then(function (dataUrl) {
            self.linkSaveLabels.download = 'chemviewer_labels.png';
            self.linkSaveLabels.href = dataUrl;
            self.afterSave();
            self.saveImageLabels = false;
        });
    } else {
        this.render();
        this.controls.update();
    }
}

ChemViewer.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
}

// Either shows or hides the unit cell
ChemViewer.prototype.toggleUnitCell = function (toggle) {
    this.showUnitCell = toggle;
    if (this.corners != undefined) {
        this.scene[toggle ? 'add' : 'remove'](this.corners);
        this.render();
    }
    const el = this.getElementById("chemviewer_unitcell");
    el.checked = toggle;
}

// shows or hides the labels
ChemViewer.prototype.toggleLabels = function (toggle) {
    let labels = this.s.querySelectorAll('.chemviewer_label')
    this.showLabels = toggle;
    if (toggle) {
        labels.forEach(e => e.classList.remove("hidden"));
    } else {
        labels.forEach(e => e.classList.add("hidden"));
    }
    const el = this.getElementById("chemviewer_labels");
    el.checked = toggle;
    this.render();
}

// overwrites given styles
ChemViewer.prototype.setStyles = function (styles) {
    var self = this;
    Object.entries(styles).forEach(([el, elStyle]) => {
        if (self.data.hasOwnProperty(el)) {
            Object.entries(elStyle).forEach(([key, val]) => {
                this.data[el][key] = val;
            });
        } else {
            this.data[el] = elStyle;
        }
    });
}

ChemViewer.prototype.defaultStyles = {
    Ac: { color: 0x70aaf9, radius: 1.95 },
    Ag: { color: 0xbfbfbf, radius: 1.6 },
    Al: { color: 0xbfa5a5, radius: 1.25 },
    Am: { color: 0x545bf2, radius: 1.75 },
    Ar: { color: 0x80d1e2, radius: 0.71 },
    As: { color: 0xbc80e2, radius: 1.15 },
    Au: { color: 0xffd123, radius: 1.35 },
    B: { color: 0xffb5b5, radius: 0.85 },
    Ba: { color: 0x00c800, radius: 2.15 },
    Be: { color: 0xc1ff00, radius: 1.05 },
    Bi: { color: 0x9e4fb5, radius: 1.6 },
    Br: { color: 0xa52828, radius: 1.15 },
    C: { color: 0x909090, radius: 0.7 },
    Ca: { color: 0x3dff00, radius: 1.8 },
    Cd: { color: 0xffd88e, radius: 1.55 },
    Ce: { color: 0xffffc6, radius: 1.85 },
    Cl: { color: 0x1fef1f, radius: 1.0 },
    Co: { color: 0xef90a0, radius: 1.35 },
    Cr: { color: 0x8999c6, radius: 1.4 },
    Cs: { color: 0x56178e, radius: 2.6 },
    Cu: { color: 0xc88033, radius: 1.35 },
    Dy: { color: 0x1fffc6, radius: 1.75 },
    Er: { color: 0x00e675, radius: 1.75 },
    Eu: { color: 0x60ffc6, radius: 1.85 },
    F: { color: 0x90df4f, radius: 0.5 },
    Fe: { color: 0xdf6633, radius: 1.4 },
    Ga: { color: 0xc18e8e, radius: 1.3 },
    Gd: { color: 0x44ffc6, radius: 1.8 },
    Ge: { color: 0x668e8e, radius: 1.25 },
    H: { color: 0xeeeeee, radius: 0.25 },
    Hf: { color: 0x4dc1ff, radius: 1.55 },
    Hg: { color: 0xb8b8cf, radius: 1.5 },
    Ho: { color: 0x00ff9c, radius: 1.75 },
    I: { color: 0x930093, radius: 1.4 },
    In: { color: 0xa57572, radius: 1.55 },
    Ir: { color: 0x175487, radius: 1.35 },
    K: { color: 0x8e3fd4, radius: 2.2 },
    La: { color: 0x70d4ff, radius: 1.95 },
    Li: { color: 0xcc80ff, radius: 1.45 },
    Lu: { color: 0x00aa23, radius: 1.75 },
    Mg: { color: 0x89ff00, radius: 1.5 },
    Mn: { color: 0x9c79c6, radius: 1.4 },
    Mo: { color: 0x54b5b5, radius: 1.45 },
    N: { color: 0x2f4ff7, radius: 0.65 },
    Na: { color: 0xaa5bf2, radius: 1.8 },
    Nb: { color: 0x72c1c8, radius: 1.45 },
    Nd: { color: 0xc6ffc6, radius: 1.85 },
    Ni: { color: 0x4fcf4f, radius: 1.35 },
    Np: { color: 0x0080ff, radius: 1.75 },
    O: { color: 0xff0d0d, radius: 0.6 },
    Os: { color: 0x266695, radius: 1.3 },
    P: { color: 0xff8000, radius: 1.0 },
    Pa: { color: 0x00a1ff, radius: 1.8 },
    Pb: { color: 0x565960, radius: 1.8 },
    Pd: { color: 0x006985, radius: 1.4 },
    Pm: { color: 0xa3ffc6, radius: 1.85 },
    Po: { color: 0xaa5b00, radius: 1.9 },
    Pr: { color: 0xd8ffc6, radius: 1.85 },
    Pt: { color: 0xcfcfdf, radius: 1.35 },
    Pu: { color: 0x006bff, radius: 1.75 },
    Ra: { color: 0x007c00, radius: 2.15 },
    Rb: { color: 0x702daf, radius: 2.35 },
    Re: { color: 0x267caa, radius: 1.35 },
    Rh: { color: 0x0a7c8c, radius: 1.35 },
    Ru: { color: 0x238e8e, radius: 1.3 },
    S: { color: 0xffff2f, radius: 1.0 },
    Sb: { color: 0x9e62b5, radius: 1.45 },
    Sc: { color: 0xe6e6e6, radius: 1.6 },
    Se: { color: 0xffa100, radius: 1.15 },
    Si: { color: 0xefc8a0, radius: 1.1 },
    Sm: { color: 0x8effc6, radius: 1.85 },
    Sn: { color: 0x668080, radius: 1.45 },
    Sr: { color: 0x00ff00, radius: 2.0 },
    Ta: { color: 0x4da5ff, radius: 1.45 },
    Tb: { color: 0x2fffc6, radius: 1.75 },
    Tc: { color: 0x3b9e9e, radius: 1.35 },
    Te: { color: 0xd47900, radius: 1.4 },
    Th: { color: 0x00baff, radius: 1.8 },
    Ti: { color: 0xbfc1c6, radius: 1.4 },
    Tl: { color: 0xa5544d, radius: 1.9 },
    Tm: { color: 0x00d452, radius: 1.75 },
    U: { color: 0x008eff, radius: 1.75 },
    V: { color: 0xa5a5aa, radius: 1.35 },
    W: { color: 0x2193d6, radius: 1.35 },
    Y: { color: 0x93ffff, radius: 1.8 },
    Yb: { color: 0x00bf38, radius: 1.75 },
    Zn: { color: 0x7c80af, radius: 1.35 },
    Zr: { color: 0x93dfdf, radius: 1.55 },
    bond: { color: 0x0c0c0c, radius: 0.18 },
    unknown: { color: 0x000000, radius: 0.8 }
}

export default ChemViewer
