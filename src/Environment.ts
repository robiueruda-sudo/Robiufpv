import * as THREE from 'three';

export class Environment {
  private scene: THREE.Scene;
  private obstacles: THREE.Mesh[] = [];
  private flashingLights: Array<{ mesh: THREE.Mesh; light: THREE.PointLight; phase: number }> = [];
  private sun!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildSky();
    this.buildTerrain();
    this.buildLighting();
    this.buildTrees();
    this.buildGates();
    this.buildPylons();
    this.buildWalls();
  }

  private buildSky(): void {
    // Hemisphere sky mesh with gradient shader
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:    { value: new THREE.Color(0x0a1f6e) },
        horizonColor:{ value: new THREE.Color(0xe8722a) },
        bottomColor: { value: new THREE.Color(0x4a3020) },
        offset:      { value: 20 },
        exponent:    { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          vec3 color;
          if (h > 0.0) {
            color = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
          } else {
            color = mix(horizonColor, bottomColor, pow(max(-h, 0.0), 0.5));
          }
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }

  private buildTerrain(): void {
    // Flat ground plane
    const groundGeo = new THREE.PlaneGeometry(500, 500, 60, 60);
    const positions = groundGeo.attributes['position'];

    // Gentle rolling hills via vertex displacement
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i); // plane is XY before rotation

      // Keep area near origin flat for landing
      const distFromCenter = Math.sqrt(x * x + z * z);
      const hillFactor = Math.min(1, (distFromCenter - 20) / 60);

      if (hillFactor > 0) {
        const h = (
          Math.sin(x * 0.04) * Math.cos(z * 0.03) * 2.5 +
          Math.sin(x * 0.09 + 1.2) * Math.cos(z * 0.07) * 1.2 +
          Math.sin(x * 0.02 + z * 0.015) * 1.8
        ) * hillFactor;
        positions.setZ(i, h);
      }
    }

    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3a6b35,
      roughness: 0.95,
      metalness: 0.0,
    });

    // Subtle grid overlay
    const gridMat = new THREE.MeshStandardMaterial({
      color: 0x3a6b35,
      roughness: 0.95,
      wireframe: false,
    });
    void gridMat; // used via groundMat

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper for visual reference
    const grid = new THREE.GridHelper(500, 50, 0x2a5a25, 0x2a5a25);
    (grid.material as THREE.LineBasicMaterial).opacity = 0.3;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    this.scene.add(grid);
  }

  private buildLighting(): void {
    // Ambient
    const ambient = new THREE.AmbientLight(0x3a4a6a, 0.6);
    this.scene.add(ambient);

    // Hemisphere (sky/ground)
    const hemi = new THREE.HemisphereLight(0x7ec8e3, 0x4a7a30, 0.5);
    this.scene.add(hemi);

    // Sun (directional)
    const sun = new THREE.DirectionalLight(0xffd280, 1.2);
    sun.position.set(80, 60, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 400;
    sun.shadow.camera.left   = -100;
    sun.shadow.camera.right  =  100;
    sun.shadow.camera.top    =  100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.sun = sun;

    // Fill light from opposite side
    const fill = new THREE.DirectionalLight(0x4466aa, 0.3);
    fill.position.set(-50, 30, 40);
    this.scene.add(fill);
  }

  private buildTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d7a2d, roughness: 0.8 });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x1a6020, roughness: 0.8 });

    const treePositions = [
      [20, 15], [35, -10], [-25, 20], [-40, -15], [50, 30],
      [-15, 40], [30, -40], [-50, 25], [45, -25], [10, -35],
      [-30, -35], [60, 10], [-60, -10], [25, 55], [-20, -55],
    ];

    for (const [tx, tz] of treePositions) {
      const scale = 0.7 + Math.random() * 0.6;
      const group = new THREE.Group();

      // Trunk
      const trunkH = 3 * scale;
      const trunkGeo = new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, trunkH, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      group.add(trunk);

      // Multiple foliage layers for pine tree look
      const mat = Math.random() > 0.5 ? foliageMat : foliageMat2;
      for (let layer = 0; layer < 3; layer++) {
        const r = (1.4 - layer * 0.3) * scale;
        const h = (2.0 - layer * 0.3) * scale;
        const foliageGeo = new THREE.ConeGeometry(r, h, 8);
        const foliage = new THREE.Mesh(foliageGeo, mat);
        foliage.position.y = trunkH + layer * 0.8 * scale;
        foliage.castShadow = true;
        group.add(foliage);
      }

      group.position.set(tx, 0, tz);
      this.scene.add(group);

      // Add trunk as obstacle
      const obstacleGeo = new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, trunkH, 8);
      const obstacleMesh = new THREE.Mesh(obstacleGeo, trunkMat);
      obstacleMesh.position.set(tx, trunkH / 2, tz);
      obstacleMesh.visible = false;
      this.scene.add(obstacleMesh);
      this.obstacles.push(obstacleMesh);
    }
  }

  private buildGates(): void {
    const gateMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.4, metalness: 0.7 });

    const gateConfigs = [
      { x: 10, z: 0,   ry: 0,           w: 4, h: 3 },
      { x: 25, z: 10,  ry: Math.PI / 6, w: 4, h: 3 },
      { x: 15, z: 25,  ry: Math.PI / 4, w: 5, h: 3.5 },
      { x: -10, z: 15, ry: -Math.PI / 5, w: 4, h: 3 },
      { x: 0,  z: -20, ry: Math.PI / 3, w: 4, h: 2.5 },
    ];

    for (const cfg of gateConfigs) {
      const group = new THREE.Group();
      const thick = 0.12;

      // Top bar
      const topGeo = new THREE.BoxGeometry(cfg.w + thick * 2, thick, thick);
      const top = new THREE.Mesh(topGeo, gateMat);
      top.position.y = cfg.h;
      top.castShadow = true;
      group.add(top);

      // Bottom bar
      const botGeo = new THREE.BoxGeometry(cfg.w + thick * 2, thick, thick);
      const bot = new THREE.Mesh(botGeo, gateMat);
      bot.position.y = 0.06;
      group.add(bot);

      // Left post
      const leftGeo = new THREE.BoxGeometry(thick, cfg.h + thick, thick);
      const left = new THREE.Mesh(leftGeo, gateMat);
      left.position.set(-cfg.w / 2, cfg.h / 2, 0);
      left.castShadow = true;
      group.add(left);

      // Right post
      const rightGeo = new THREE.BoxGeometry(thick, cfg.h + thick, thick);
      const right = new THREE.Mesh(rightGeo, gateMat);
      right.position.set(cfg.w / 2, cfg.h / 2, 0);
      right.castShadow = true;
      group.add(right);

      // LED strips on gate
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 1.0,
      });
      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, 0.04, 0.04), ledMat);
      ledStrip.position.y = cfg.h;
      group.add(ledStrip);

      group.position.set(cfg.x, 0, cfg.z);
      group.rotation.y = cfg.ry;
      this.scene.add(group);

      // Invisible collision posts
      for (const xOff of [-cfg.w / 2, cfg.w / 2]) {
        const collGeo = new THREE.BoxGeometry(0.2, cfg.h, 0.2);
        const coll = new THREE.Mesh(collGeo, gateMat);
        coll.position.set(cfg.x + xOff * Math.cos(cfg.ry), cfg.h / 2, cfg.z + xOff * Math.sin(cfg.ry));
        coll.visible = false;
        this.scene.add(coll);
        this.obstacles.push(coll);
      }
    }
  }

  private buildPylons(): void {
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3, metalness: 0.8 });

    const pylonPositions: [number, number][] = [[-20, -10], [40, 20], [-5, -30]];

    for (const [px, pz] of pylonPositions) {
      const height = 15 + Math.random() * 5;
      const group = new THREE.Group();

      // Main pole
      const poleGeo = new THREE.CylinderGeometry(0.15, 0.25, height, 8);
      const pole = new THREE.Mesh(poleGeo, pylonMat);
      pole.position.y = height / 2;
      pole.castShadow = true;
      group.add(pole);

      // Cross arms
      for (let arm = 0; arm < 2; arm++) {
        const armGeo = new THREE.BoxGeometry(4, 0.1, 0.1);
        const armMesh = new THREE.Mesh(armGeo, pylonMat);
        armMesh.position.y = height - 1 - arm * 2;
        armMesh.castShadow = true;
        group.add(armMesh);
      }

      // Flashing light at top
      const lightGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff2200,
        emissiveIntensity: 2.0,
      });
      const lightBulb = new THREE.Mesh(lightGeo, lightMat);
      lightBulb.position.y = height + 0.15;
      group.add(lightBulb);

      // Point light for glow
      const pointLight = new THREE.PointLight(0xff2200, 2.0, 15);
      pointLight.position.y = height + 0.15;
      group.add(pointLight);

      group.position.set(px, 0, pz);
      this.scene.add(group);

      this.flashingLights.push({ mesh: lightBulb, light: pointLight, phase: Math.random() * Math.PI * 2 });

      // Collision cylinder
      const collGeo = new THREE.CylinderGeometry(0.3, 0.3, height, 8);
      const coll = new THREE.Mesh(collGeo, pylonMat);
      coll.position.set(px, height / 2, pz);
      coll.visible = false;
      this.scene.add(coll);
      this.obstacles.push(coll);
    }
  }

  private buildWalls(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, metalness: 0.1 });

    const wallConfigs = [
      { x: -15, z: 5,   rx: 0, w: 8, h: 1.5, d: 0.4 },
      { x: 20,  z: -5,  rx: Math.PI / 4, w: 6, h: 1.2, d: 0.4 },
      { x: -30, z: -20, rx: 0, w: 10, h: 2.0, d: 0.4 },
      { x: 10,  z: 35,  rx: Math.PI / 3, w: 7, h: 1.5, d: 0.4 },
    ];

    for (const cfg of wallConfigs) {
      const wallGeo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(cfg.x, cfg.h / 2, cfg.z);
      wall.rotation.y = cfg.rx;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.obstacles.push(wall);
    }
  }

  getObstacles(): THREE.Mesh[] {
    return this.obstacles;
  }

  update(dt: number, elapsed: number): void {
    // Flash pylon lights
    for (const fl of this.flashingLights) {
      const brightness = Math.sin(elapsed * 2.5 + fl.phase) > 0 ? 2.0 : 0.0;
      const mat = fl.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = brightness;
      fl.light.intensity = brightness * 1.5;
    }

    void dt;
    void this.sun;
  }
}
