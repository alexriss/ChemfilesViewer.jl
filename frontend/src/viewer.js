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
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

function ChemViewer() {
    //
}


// Creates a new instance of imolecule
ChemViewer.prototype.create = function (selector, options) {

    var s = document.querySelector(selector), self = this, hasWebgl;
    options = options || {};
    this.s = s;

    this.shader = options.hasOwnProperty('shader') ? options.shader : 'lambert';
    this.drawingType = options.hasOwnProperty('drawingType') ? options.drawingType : 'ball and stick';
    this.cameraType = options.hasOwnProperty('cameraType') ? options.cameraType : 'perspective';
    this.quality = options.hasOwnProperty('quality') ? options.quality : 'high';
    this.showUnitCell = options.hasOwnProperty('showUnitCell') ? options.showUnitCell : true;
    this.showLabels = options.hasOwnProperty('showLabels') ? options.showLabels : false;
    this.updateCamera = (this.cameraType === 'orthographic');
    this.saveImage = false;
    this.saveImageDownload = true;
    this.linkSave = document.createElement('a');

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
            'does not support either WebGL or Canvas. Please upgrade.</p>';
        return;
    }
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(s.clientWidth, s.clientHeight);
    s.appendChild(this.renderer.domElement);

    // for labels
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(s.clientWidth, s.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    s.appendChild(this.labelRenderer.domElement);

    this.perspective = new PerspectiveCamera(80, s.clientWidth / s.clientHeight);
    this.orthographic = new OrthographicCamera(-s.clientWidth / 32,
        s.clientWidth / 32, s.clientHeight / 32, -s.clientHeight / 32, -100, 1000);
    this.orthographic.z = 10;

    var widthSegments = (this.quality === "high") ? 64 : 16;
    var heightSegments = (this.quality === "high") ? 48 : 12;
    var radialSegments = (this.quality === "high") ? 48 : 6;
    var heightSegments = (this.quality === "high") ? 16 : 3;
    this.sphereGeometry = new SphereGeometry(1, widthSegments, heightSegments);
    this.cylinderGeometry = new CylinderGeometry(1, 1, 1, radialSegments, heightSegments, false);

    // This orients the cylinder primitive so THREE.lookAt() works properly
    this.cylinderGeometry.applyMatrix4(new Matrix4()
        .makeRotationFromEuler(new Euler(Math.PI / 2, Math.PI, 0)));

    this.light = new HemisphereLight(0xffffff, 0.5);
    this.directionalLight = new DirectionalLight(0xffffff, 0.05);
    this.directionalLight.position.set(1, 1, 1);
    // this.directionalLight.position.set(0, 0, 20);

    this.atoms = [];
    this.bonds = [];
    this.corners = undefined;

    // Initializes a scene and appends objects to be drawn
    this.scene = new Scene();
    this.scene.add(this.perspective);
    this.scene.add(this.orthographic);

    this.setCameraType('perspective');
    this.makeMaterials();

    window.addEventListener('resize', function (e) {
        self.renderer.setSize(s.clientWidth, s.clientHeight);
        self.labelRenderer.setSize(s.clientWidth, s.clientHeight);
        self.perspective.aspect = s.clientWidth / s.clientHeight;
        self.perspective.updateProjectionMatrix();
        self.orthographic.left = -s.clientWidth / 32.0;
        self.orthographic.right = s.clientWidth / 32.0;
        self.orthographic.top = s.clientHeight / 32.0;
        self.orthographic.bottom = -s.clientHeight / 32.0;
        self.orthographic.updateProjectionMatrix();
        self.render();
    });

    var _this = this;
    document.getElementById('chemviewer_drawingtype').value = this.drawingType;
    document.getElementById('chemviewer_drawingtype').addEventListener('change', function (e) {
        _this.setDrawingType(e.target.value);
    });
    document.getElementById('chemviewer_cameratype').value = this.cameraType;
    document.getElementById('chemviewer_cameratype').addEventListener('change', function (e) {
        _this.setCameraType(e.target.value);
    });
    document.getElementById('chemviewer_shader').value = this.shader;
    document.getElementById('chemviewer_shader').addEventListener('change', function (e) {
        _this.setShader(e.target.value);
    });
    document.getElementById('chemviewer_unitcell').checked = this.showUnitCell;
    document.getElementById('chemviewer_unitcell').addEventListener('change', function (e) {
        _this.toggleUnitCell(e.target.checked);
    });
    document.getElementById('chemviewer_labels').checked = this.showLabels;
    document.getElementById('chemviewer_labels').addEventListener('change', function (e) {
        _this.toggleLabels(e.target.checked);
    });
    document.getElementById('chemviewer_save').addEventListener('click', function (e) {
        _this.save();
    });

    this.render();
    this.animate();
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
        trans, geometry, material, atomColor, maxHeight, maxX, maxY, maxZ,
        minX, minY, minZ, centerX, centerY, centerZ, cameraZ;
    self = this;
    cent = new Vector3();
    this.current = molecule;

    scale = this.drawingType === 'space filling' ? 1.0 : 0.3;

    // Don't hate on formats without bond information
    if (!molecule.hasOwnProperty('bonds')) { molecule.bonds = []; }

    // Draws atoms and saves references
    maxHeight = 0;
    maxX = molecule.atoms[0].location[0];
    maxY = molecule.atoms[0].location[1];
    minX = molecule.atoms[0].location[0];
    minY = molecule.atoms[0].location[1];
    maxZ = molecule.atoms[0].location[2];
    minZ = molecule.atoms[0].location[2];
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
            labelDiv.textContent = atom.label;
            labelDiv.style.color = '#' + atomColor.toString(16);
            if (!this.showLabels) {
                labelDiv.classList.add("hidden");
            }
            let atomLabel = new CSS2DObject( labelDiv );
            atomLabel.position.set( 0, 0, 0 );
            mesh.add( atomLabel );
        }

        if (self.drawingType === 'wireframe') {
            mesh.visible = false;  // we need the object for the labels, but just set it to invisible
        }
        self.scene.add(mesh);
        mesh.element = atom.element;
        self.atoms.push(mesh);

        maxHeight = Math.max(maxHeight, Math.abs(atom.location[0]), Math.abs(atom.location[1]));
        maxX = Math.max(maxX, atom.location[0]);
        maxY = Math.max(maxY, atom.location[1]);
        maxZ = Math.max(maxZ, atom.location[2]);
        minX = Math.min(minX, atom.location[0]);
        minY = Math.min(minY, atom.location[1]);
        minZ = Math.min(minZ, atom.location[2]);
    }

    // Sets camera position to view whole molecule in bounds with some buffer
    if (resetCamera) {
        self.controls.reset();
        cameraZ = (maxHeight / Math.tan(Math.PI * self.camera.fov / 360) + maxZ) / 0.8;
        self.perspective.position.z = cameraZ;

        centerX = (minX + maxX) / 2;
        centerY = (minY + maxY) / 2;
        centerZ = (minZ + maxZ) / 2;
        self.perspective.position.x = centerX;
        self.perspective.position.y = centerY;
        self.controls.target.set( centerX, centerY, centerZ ); // pivot point

        self.directionalLight.target.position.set(centerX, centerY, centerZ);
        this.directionalLight.position.copy(this.camera.position)
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

    // If we're dealing with a crystal structure, draw the unit cell
    if (this.showUnitCell && molecule.hasOwnProperty('unitcell') && molecule.unitcell.length == 3) {
        // Some basic conversions to handle math via THREE.Vector3
        v = new Vector3(0, 0, 0);
        vectors = [
            v.clone().fromArray(molecule.unitcell[0]),
            v.clone().fromArray(molecule.unitcell[1]),
            v.clone().fromArray(molecule.unitcell[2])
        ];
        // The eight corners of the unit cell are linear combinations of above
        points = [
            v.clone(), vectors[0], vectors[1], vectors[2],
            v.clone().add(vectors[0]).add(vectors[1]).add(vectors[2]),
            v.clone().add(vectors[1]).add(vectors[2]),
            v.clone().add(vectors[0]).add(vectors[2]),
            v.clone().add(vectors[0]).add(vectors[1])
        ];
        // Translate unit cell to center around mof + origin
        trans = points[4].clone().multiplyScalar(0.5);
        for (j = 0; j < points.length; j += 1) {
            points[j].sub(trans);
        }
        // Draw the box line-by-line
        const geometryPoints = [];
        for (const [index, value] of [0, 1, 0, 2, 0, 3, 6, 1, 7, 2, 5, 3, 5, 4, 6, 4, 7].entries()) {
            geometryPoints.push(points[value]);
        }
        geometry = new BufferGeometry().setFromPoints( geometryPoints );
        material = new LineBasicMaterial({ color: 0x000000, linewidth: 3 });

        this.corners = new Line(geometry, material);
        this.scene.add(this.corners);
    }

    if (molecule.hasOwnProperty('unitcell') && molecule.unitcell.length == 3) {
        document.getElementById('chemviewer_unitcell').disabled = false;
        document.getElementById('chemviewer_unitcell').checked = this.showUnitCell;
        document.getElementById('chemviewer_unitcell_label').classList.remove("disabled");
    } else {
        document.getElementById('chemviewer_unitcell').disabled = true;
        document.getElementById('chemviewer_unitcell').checked = false;
        document.getElementById('chemviewer_unitcell_label').classList.add("disabled");
    }

    // If drawing in orthographic, controls need to be initialized *after*
    // building the molecule. This should be triggered at most once, and only
    // when imolecule.create($d, {cameraType: 'orthographic'}) is used.
    if (this.updateCamera) {
        this.setCameraType('orthographic');
        this.updateCamera = false;
    }
    this.render();
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


// Request to save a screenshot of the current canvas.
ChemViewer.prototype.save = async function (downloadImage = true) {
    this.saveImageDownload = downloadImage;
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
    return this.linkSave.href
}

// Sets molecule drawing types ( ball and stick, space filling, wireframe )
ChemViewer.prototype.setDrawingType = function (type) {
    // Some case-by-case logic to avoid clearing and redrawing the canvas
    var i;
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
    this.controls.rotateSpeed = 3;
    this.controls.addEventListener('change', function () { self.render(); });
    this.camera.add(this.light);
    this.camera.add(this.directionalLight);
    this.render();
}

// Sets shader (toon, basic, phong, lambert) and redraws
ChemViewer.prototype.setShader = function (shader) {
    this.shader = shader;
    this.makeMaterials();
    this.clear();
    this.draw(this.current, false);
}

// Runs the main window animation in an infinite loop
ChemViewer.prototype.animate = function () {
    var self = this, w, h, renderWidth;
    window.requestAnimationFrame(function () {
        return self.animate();
    });
    if (this.saveImage) {
        renderWidth = 2560 / (window.devicePixelRatio || 1);
        w = this.s.clientWidth; h = this.s.clientHeight;
        this.renderer.setSize(renderWidth, renderWidth * h / w);
        this.labelRenderer.setSize(renderWidth, renderWidth * h / w);
        this.render();

        var pngBase64 = this.renderer.domElement.toDataURL('image/png')
        this.linkSave.download = 'chemviewer.png';
        this.linkSave.href = pngBase64;

        this.renderer.setSize(w, h);
        this.labelRenderer.setSize(w, h);
        this.saveImage = false;

        if (this.saveImageDownload) {
            this.linkSave.click();
        }
    }
    this.render();
    this.controls.update();
}

ChemViewer.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
}

// Either shows or hides the unit cell
ChemViewer.prototype.toggleUnitCell = function (toggle) {
    if (this.corners != undefined) {
        this.scene[toggle ? 'add' : 'remove'](this.corners);
        this.render();
    }
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
    this.render();
}

ChemViewer.prototype.data = {
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
