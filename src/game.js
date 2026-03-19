class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot');
    }
    preload() {
        // Generate textures here
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });

        // Player Debris
        graphics.clear();
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('debris', 8, 8);

        // Bullet
        graphics.clear();
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(6, 6, 6);
        graphics.generateTexture('bullet', 12, 12);

        // Enemy
        graphics.clear();
        graphics.fillStyle(0x00FF00, 1); // Neon Green
        graphics.lineStyle(2, 0xFFFFFF, 0.8);
        // Draw a centered triangle
        graphics.beginPath();
        graphics.moveTo(15, 0);
        graphics.lineTo(30, 25);
        graphics.lineTo(0, 25);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        graphics.generateTexture('enemy', 30, 30);

        // Powerup
        graphics.clear();
        graphics.fillStyle(0xFFD700, 1); // Gold
        graphics.fillCircle(10, 10, 10);
        graphics.generateTexture('powerup', 20, 20);

        // Spike
        graphics.clear();
        graphics.fillStyle(0xFF0000, 1); // Red
        graphics.beginPath();
        graphics.moveTo(10, 0);
        graphics.lineTo(20, 30);
        graphics.lineTo(0, 30);
        graphics.closePath();
        graphics.fillPath();
        graphics.generateTexture('spike', 20, 30);

        // Heavy Enemy (Pentagon)
        graphics.clear();
        graphics.fillStyle(0xFFA500, 1); // Orange
        graphics.lineStyle(4, 0xFFFFFF, 0.8);
        graphics.beginPath();
        const pentSize = 45; // Half of 90 for radius
        for (let i = 0; i < 5; i++) {
            const tempAngle = (i * 2 * Math.PI / 5) - Math.PI / 2;
            const px = pentSize + Math.cos(tempAngle) * pentSize;
            const py = pentSize + Math.sin(tempAngle) * pentSize;
            if (i === 0) graphics.moveTo(px, py);
            else graphics.lineTo(px, py);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        graphics.generateTexture('heavy_enemy', 90, 90);

        // Heavy Bullet
        graphics.clear();
        graphics.fillStyle(0xFFA500, 1);
        graphics.fillCircle(20, 20, 20); // 40x40 size
        graphics.generateTexture('heavy_bullet', 40, 40);
    }
    create() {
        this.scene.start('Menu');
    }
}

class MenuScene extends Phaser.Scene {
    constructor() {
        super('Menu');
    }
    create() {
        const { width, height } = this.scale;

        // Background Grid (Static)
        const bg = this.add.graphics();
        bg.lineStyle(2, 0x222222, 0.5);
        for (let x = 0; x < width; x += 50) { bg.moveTo(x, 0); bg.lineTo(x, height); }
        for (let y = 0; y < height; y += 50) { bg.moveTo(0, y); bg.lineTo(width, y); }
        bg.strokePath();

        this.add.text(width / 2, height / 2 - 50, 'ANTIGRAVITY', {
            fontFamily: 'Outfit',
            fontSize: '64px',
            fontWeight: '700',
            color: '#FF007F'
        }).setOrigin(0.5).setShadow(0, 0, '#FF007F', 15, false, true);

        const btn = this.add.container(width / 2, height / 2 + 50);
        const rect = this.add.rectangle(0, 0, 200, 60, 0x111111).setStrokeStyle(2, 0xFFFFFF, 0.5);
        const text = this.add.text(0, 0, 'START GAME', {
            fontFamily: 'Outfit',
            fontSize: '20px',
            color: '#FFFFFF'
        }).setOrigin(0.5);

        btn.add([rect, text]);
        btn.setSize(200, 60);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => rect.setStrokeStyle(4, 0xFF007F, 1));
        btn.on('pointerout', () => rect.setStrokeStyle(2, 0xFFFFFF, 0.5));
        btn.on('pointerdown', () => this.scene.start('Play'));

        this.add.text(width - 20, height - 20, 'Powered by Phaser 3', { fontSize: '12px', opacity: 0.5 }).setOrigin(1);
    }
}

class PlayScene extends Phaser.Scene {
    constructor() {
        super('Play');
    }

    init(data) {
        // Reset or persist upgrades from previous round
        this.hasExplosiveBullets = data.hasExplosiveBullets || false;
        this.hasDoubleShot = data.hasDoubleShot || false;
        this.hasIframeAbility = data.hasIframeAbility || false;
        this.score = data.score || 0;
        this.enemiesKilled = data.enemiesKilled || 0;
        this.bulletSpeedMultiplier = data.bulletSpeedMultiplier || 1;
        this.wave = data.wave || 1;
        this.playerHealth = data.playerHealth !== undefined ? data.playerHealth : 3;
    }

    create() {
        const worldWidth = 8000;
        const hotPink = 0xFF007F;
        const neonGreen = 0x00FF00;

        this.physics.world.setBounds(0, 0, worldWidth, 600);
        this.cameras.main.setBounds(0, 0, worldWidth, 600);

        // 1. Background (Parallax Grid)
        this.bg = this.add.graphics();
        this.bg.lineStyle(2, 0x222222, 0.5);
        for (let x = 0; x < worldWidth; x += 50) { this.bg.moveTo(x, 0); this.bg.lineTo(x, 600); }
        for (let y = 0; y < 600; y += 50) { this.bg.moveTo(0, y); this.bg.lineTo(worldWidth, y); }
        this.bg.strokePath();
        this.bg.setScrollFactor(0.2);

        // 2. Score & Stats
        // (Stats are now initialized in init() above)

        // Iframe Ability Stats
        this.isImmune = false;
        this.lastIframeTime = -20000;
        this.iframeCooldown = 15000; // 15 seconds
        this.iframeDuration = 5000;  // 5 seconds of immunity

        this.lastPlayerShot = 0; // Track when the player last shot

        this.scoreText = document.getElementById('score');
        this.scoreText.innerText = `SCORE: ${this.score} - WAVE: ${this.wave} - LIVES: ${this.playerHealth}`;

        // 2.1 UI for Iframe (Hidden until unlocked)
        this.iframeUIText = this.add.text(780, 20, 'IFRAME: READY', {
            fontFamily: 'Outfit', fontSize: '20px', color: '#FFFFFF', fontWeight: 'bold'
        }).setOrigin(1, 0).setScrollFactor(0).setShadow(0, 0, '#000000', 5).setVisible(this.hasIframeAbility);

        // 3. Particles
        this.particles = this.add.particles(0, 0, 'debris', {
            speed: { min: -200, max: 200 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 800,
            emitting: false,
            gravityY: 300
        });

        // 4. Player
        this.player = this.add.container(200, 450);
        const pRect = this.add.rectangle(0, 0, 40, 40, hotPink).setStrokeStyle(4, 0xffffff, 0.8);
        this.pGlow = this.add.rectangle(0, 0, 50, 50, hotPink, 0.2);
        this.player.add([this.pGlow, pRect]);

        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setDragX(1200);

        // Define precise hitbox for the player (smaller than the visual 40x40 to be fair)
        this.player.body.setSize(30, 30);
        this.player.body.setOffset(-15, -15);

        // 5. Groups
        this.walls = this.physics.add.staticGroup();
        this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
        this.enemyBullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
        this.enemies = this.physics.add.group();
        this.spikes = this.physics.add.staticGroup();

        // 6. World Generation
        // Ground
        const ground = this.add.rectangle(worldWidth / 2, 580, worldWidth, 40, 0x111111).setStrokeStyle(2, hotPink, 0.3);
        this.walls.add(ground);

        // Procedural obstacles & Enemies based on wave
        // Wave 1 = triangles only, Wave 2+ = pentagons only
        const enemyCount = 10 + (this.wave * 2);
        const segmentWidth = (worldWidth - 1000) / enemyCount;

        for (let i = 0; i < enemyCount; i++) {
            const x = 800 + (i * segmentWidth) + Phaser.Math.Between(-200, 200);

            // Occasional Wall
            if (Math.random() > 0.5) {
                const h = Phaser.Math.Between(150, 400);
                const wall = this.add.rectangle(x, 600 - h / 2 - 40, 60, h, 0x000000).setStrokeStyle(3, hotPink, 0.8);
                this.walls.add(wall);
            }

            if (this.wave === 1) {
                // Wave 1: ONLY triangle drones
                const drone = this.enemies.create(x, Phaser.Math.Between(100, 400), 'enemy');
                drone.setTint(0x00FF00);
                drone.body.setAllowGravity(false);
                drone.body.setCollideWorldBounds(true);
                drone.body.setBounce(1, 1);
                drone.isHeavy = false;
                drone.lastShot = 0;
                const angle = Math.random() * Math.PI * 2;
                const speed = Phaser.Math.Between(100, 200);
                drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            } else {
                // Wave 2+: ONLY pentagon heavies
                const drone = this.enemies.create(x, Phaser.Math.Between(100, 400), 'heavy_enemy');
                drone.setTint(0xFFA500);
                drone.body.setAllowGravity(false);
                drone.body.setCollideWorldBounds(true);
                drone.body.setBounce(1, 1);
                drone.isHeavy = true;
                drone.health = 3;
                drone.lastShot = 0;
                const angle = Math.random() * Math.PI * 2;
                const speed = Phaser.Math.Between(40, 80);
                drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            }
        }

        // 7. Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,F');
        this.input.on('pointerdown', this.shoot, this);

        // 8. Collisions
        this.physics.add.collider(this.player, this.walls);
        this.physics.add.collider(this.enemies, this.walls); // Enemies now bounce off walls
        this.physics.add.collider(this.bullets, this.walls, this.hitWall, null, this);
        this.physics.add.collider(this.enemyBullets, this.walls, this.hitWall, null, this);
        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);

        // Use wrappers for game over to check immunity and active status
        this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
            if (!enemy.active) return;
            this.takeDamage();
        }, null, this);

        this.physics.add.overlap(this.player, this.enemyBullets, (player, bullet) => {
            if (!bullet.active) return;

            // Always clear the bullet when hitting the player
            bullet.setActive(false).setVisible(false).body.setVelocity(0, 0);
            this.takeDamage();
        }, null, this);

        this.physics.add.overlap(this.player, this.spikes, (player, spike) => {
            if (!spike.active) return;
            this.takeDamage();
        }, null, this);

        // 9. Camera
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }

    update() {
        const moveSpeed = 450;

        if (this.cursors.left.isDown || this.keys.A.isDown) {
            this.player.body.setVelocityX(-moveSpeed);
            this.player.list[1].angle = -8;
        } else if (this.cursors.right.isDown || this.keys.D.isDown) {
            this.player.body.setVelocityX(moveSpeed);
            this.player.list[1].angle = 8;
        } else {
            this.player.list[1].angle = 0;
        }

        if ((this.cursors.up.isDown || this.cursors.space.isDown || this.keys.W.isDown) && this.player.body.touching.down) {
            this.player.body.setVelocityY(-800);
            this.tweens.add({ targets: this.player.list[1], scaleY: 1.4, scaleX: 0.6, duration: 100, yoyo: true });
        }

        // Iframe Ability Activation (Only if unlocked)
        if (this.hasIframeAbility && Phaser.Input.Keyboard.JustDown(this.keys.F)) {
            const timeSinceLast = this.time.now - this.lastIframeTime;
            if (timeSinceLast >= this.iframeCooldown) {
                this.activateIframe();
            }
        }

        // Update Iframe UI and State
        if (this.hasIframeAbility) {
            this.iframeUIText.setVisible(true);
            const timeSinceLast = this.time.now - this.lastIframeTime;
            if (this.isImmune && timeSinceLast > this.iframeDuration) {
                this.deactivateIframe();
            }

            if (timeSinceLast < this.iframeCooldown) {
                const remaining = Math.ceil((this.iframeCooldown - timeSinceLast) / 1000);
                this.iframeUIText.setText(`IFRAME: ${remaining}s`).setColor('#FF0000');
            } else {
                this.iframeUIText.setText('IFRAME: READY').setColor('#00FF00');
            }
        }

        // Cleanup bullets
        this.bullets.children.each(b => {
            if (b.active && Math.abs(b.x - this.player.x) > 1000) {
                b.setActive(false).setVisible(false);
                b.body.setVelocity(0, 0);
            }
        });

        // Cleanup and logic for enemy bullets
        this.enemyBullets.children.each(b => {
            if (b.active && Math.abs(b.x - this.player.x) > 1000) {
                b.setActive(false).setVisible(false);
                b.body.setVelocity(0, 0);
            }
        });

        // Enemy logic: flight & shoot
        this.enemies.children.each(drone => {
            if (!drone.active) return;

            // Face the direction of movement
            if (drone.body.velocity.x !== 0) {
                drone.setFlipX(drone.body.velocity.x < 0);
            }

            // Slight "wandering" adjustment: occasionally change direction
            if (Phaser.Math.Between(0, 100) > 98) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Phaser.Math.Between(100, 200);
                drone.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            }

            const dist = Phaser.Math.Distance.Between(drone.x, drone.y, this.player.x, this.player.y);
            // Heavy enemies shoot at shorter range but slower
            const shootRange = drone.isHeavy ? 500 : 700;
            const shootCooldown = drone.isHeavy ? 2500 : 1800;

            let canShoot = true;
            if (!drone.isHeavy) {
                canShoot = this.cameras.main.worldView.contains(drone.x, drone.y);
            }

            if (canShoot && dist < shootRange && this.time.now - drone.lastShot > shootCooldown) {
                this.enemyShoot(drone);
                drone.lastShot = this.time.now;
            }
        });

        // Effects
        this.pGlow.alpha = (this.isImmune ? 0.4 : 0.2) + Math.sin(this.time.now / 150) * 0.1;
        this.pGlow.scale = 1 + Math.sin(this.time.now / 150) * 0.1;
    }

    activateIframe() {
        this.isImmune = true;
        this.lastIframeTime = this.time.now;
        this.player.setAlpha(0.5);

        // Small flash effect
        this.tweens.add({
            targets: this.player,
            alpha: 0.2,
            duration: 100,
            yoyo: true,
            repeat: 2
        });
    }

    deactivateIframe() {
        this.isImmune = false;
        this.player.setAlpha(1);
    }

    shoot(pointer) {
        if (!this.player.active || this.physics.world.isPaused) return;

        // 0.2-second cooldown for shooting
        if (this.time.now - this.lastPlayerShot < 200) return;
        this.lastPlayerShot = this.time.now;

        const speed = 1500 * this.bulletSpeedMultiplier;
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);

        const createBullet = (offsetX = 0, offsetY = 0, angleMod = 0) => {
            const bullet = this.bullets.get(this.player.x + offsetX, this.player.y + offsetY);
            if (bullet) {
                bullet._hitting = false; // Reset hit guard for recycled bullets
                bullet.setActive(true).setVisible(true).setTint(0xFF007F);
                bullet.body.setAllowGravity(false);
                bullet.body.setCircle(4, 2, 2);
                const finalAngle = angle + angleMod;
                bullet.body.setVelocity(Math.cos(finalAngle) * speed, Math.sin(finalAngle) * speed);
            }
        };

        if (this.hasDoubleShot) {
            createBullet(0, -10, -0.05);
            createBullet(0, 10, 0.05);
        } else {
            createBullet();
        }

        this.cameras.main.shake(100, 0.003);
    }

    enemyShoot(drone) {
        if (!drone.active) return;

        let bulletKey = 'bullet';
        let speed = 500;
        let tint = 0x00FF00;

        if (drone.isHeavy) {
            bulletKey = 'heavy_bullet'; // We use the group but change texture manually
            speed = 375; // Slower bullet
            tint = 0xFFA500;
        }

        const bullet = this.enemyBullets.get(drone.x, drone.y);

        if (bullet) {
            if (drone.isHeavy) {
                bullet.setTexture('heavy_bullet');
                bullet.body.setSize(40, 40);
                bullet.body.setCircle(20);
            } else {
                bullet.setTexture('bullet');
                bullet.body.setSize(12, 12);
                bullet.body.setCircle(4, 2, 2);
            }

            bullet.setActive(true).setVisible(true).setTint(tint);
            bullet.body.setAllowGravity(false);

            const angle = Phaser.Math.Angle.Between(drone.x, drone.y, this.player.x, this.player.y);
            bullet.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
    }

    hitWall(bullet, wall) {
        const isPlayerBullet = this.bullets.contains(bullet);
        const isEnemyBullet = this.enemyBullets.contains(bullet);

        // Logic for ALL bullets hitting walls
        if (wall.height > 50) {
            if (isPlayerBullet) {
                this.particles.emitParticleAt(bullet.x, bullet.y, 10);
                this.tweens.add({
                    targets: wall,
                    alpha: 0,
                    scaleX: 0,
                    duration: 200,
                    onComplete: () => wall.destroy()
                });
                this.cameras.main.shake(200, 0.01);
                this.updateScore(10);
            } else {
                // Enemy bullet hits a tall wall: just disappear
                this.particles.emitParticleAt(bullet.x, bullet.y, 5);
            }
        }

        // SPECIFIC LOGIC FOR ENEMY BULLETS HITTING THE GROUND
        // If it's an enemy bullet and it hits near the floor (y > 540)
        if (isEnemyBullet && bullet.y > 540) {
            const spike = this.spikes.create(bullet.x, 565, 'spike');
            spike.setTint(0xFF0000);

            // Small pop-in animation for spike
            spike.setScale(0);
            this.tweens.add({
                targets: spike,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Back.easeOut'
            });

            // Spikes disappear after 5 seconds
            this.time.delayedCall(5000, () => {
                if (spike.active) {
                    this.tweens.add({
                        targets: spike,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => spike.destroy()
                    });
                }
            });
        }

        // Always deactivate the bullet after hit
        bullet.setActive(false).setVisible(false).body.setVelocity(0, 0);
    }

    hitEnemy(bullet, enemy) {
        // Guard: prevent duplicate overlap calls in the same frame for this bullet
        if (!bullet.active || !enemy.active) return;
        if (bullet._hitting) return;
        bullet._hitting = true;

        // Deactivate bullet
        bullet.setActive(false).setVisible(false).body.setVelocity(0, 0);

        if (enemy.isHeavy) {
            // Reduce heavy enemy HP
            enemy.health -= 1;

            if (enemy.health <= 0) {
                // Destroyed!
                this.particles.emitParticleAt(enemy.x, enemy.y, 40);
                if (this.hasExplosiveBullets) this.createExplosion(enemy.x, enemy.y);
                enemy.destroy();
                this.cameras.main.shake(400, 0.02);
                this.updateScore(150);
                this.enemiesKilled++;
            } else {
                // Hit but not dead: flash and change color based on remaining HP
                // HP 2 = dark orange, HP 1 = red
                const hpTint = enemy.health === 2 ? 0xFF8800 : 0xFF3300;
                this.tweens.add({
                    targets: enemy,
                    alpha: 0.2,
                    duration: 80,
                    yoyo: true,
                    repeat: 1,
                    onComplete: () => {
                        if (enemy.active) enemy.setTint(hpTint);
                    }
                });
                this.cameras.main.shake(150, 0.008);
            }
        } else {
            // Normal enemy - dies in one hit
            this.particles.emitParticleAt(enemy.x, enemy.y, 25);
            if (this.hasExplosiveBullets) {
                this.createExplosion(enemy.x, enemy.y);
            } else {
                enemy.destroy();
            }
            this.cameras.main.shake(300, 0.015);
            this.updateScore(50);
            this.enemiesKilled++;
        }

        // Speed powerup every 5 kills
        if (this.enemiesKilled % 5 === 0) {
            this.bulletSpeedMultiplier += 0.2;
        }

        // Check if all enemies are gone
        if (this.enemies.countActive() === 0) {
            this.showUpgradeMenu();
        }
    }

    createExplosion(x, y) {
        const radius = 80; // Roughly 2 player widths (40x2)
        const explosionCircle = this.add.circle(x, y, radius, 0xFF007F, 0.3);

        this.tweens.add({
            targets: explosionCircle,
            scale: 1.5,
            alpha: 0,
            duration: 300,
            onComplete: () => explosionCircle.destroy()
        });

        // Kill all enemies in range
        this.enemies.children.each(enemy => {
            if (enemy.active) {
                const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
                if (dist <= radius) {
                    this.particles.emitParticleAt(enemy.x, enemy.y, 15);
                    enemy.destroy();
                    this.updateScore(25);
                }
            }
        });
    }
    showUpgradeMenu() {
        this.physics.pause();
        const { width, height } = this.scale;

        // Store all menu elements so we can destroy them all at once
        const menuElements = [];

        const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
            .setScrollFactor(0).setDepth(1000);
        menuElements.push(bg);

        const title = this.add.text(width / 2, height / 2 - 190, 'CHOOSE YOUR UPGRADE', {
            fontFamily: 'Outfit', fontSize: '28px', color: '#FF007F', fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
        menuElements.push(title);

        const options = [
            {
                title: 'EXPLOSIVE AMMO',
                desc: 'Bullets explode on impact,\nhitting nearby enemies (2x Player size)',
                apply: () => { this.hasExplosiveBullets = true; }
            },
            {
                title: 'DOUBLE SHOT',
                desc: 'Fire two bullets at once\nfor maximum coverage',
                apply: () => { this.hasDoubleShot = true; }
            },
            {
                title: 'IFRAME ABILITY',
                desc: 'Press "F" for 5 seconds of\ntotal immunity (15s Cooldown)',
                apply: () => { this.hasIframeAbility = true; }
            }
        ];

        options.forEach((opt, i) => {
            const cx = width / 2;
            const cy = height / 2 - 80 + (i * 130);

            const btn = this.add.rectangle(cx, cy, 520, 115, 0x111111)
                .setStrokeStyle(2, 0xFFFFFF, 0.5)
                .setScrollFactor(0)
                .setDepth(1001)
                .setInteractive({ useHandCursor: true });

            const titleTxt = this.add.text(cx, cy - 32, opt.title, {
                fontFamily: 'Outfit', fontSize: '22px', color: '#FF007F', fontWeight: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

            const descTxt = this.add.text(cx, cy + 2, opt.desc, {
                fontFamily: 'Outfit', fontSize: '13px', color: '#AAAAAA', align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

            const chooseTxt = this.add.text(cx, cy + 42, '[ CHOOSE ]', {
                fontFamily: 'Outfit', fontSize: '15px', color: '#FFFFFF', fontWeight: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

            menuElements.push(btn, titleTxt, descTxt, chooseTxt);

            btn.on('pointerover', () => {
                btn.setStrokeStyle(3, 0xFF007F, 1).setFillStyle(0x220011);
                chooseTxt.setColor('#FF007F');
            });
            btn.on('pointerout', () => {
                btn.setStrokeStyle(2, 0xFFFFFF, 0.5).setFillStyle(0x111111);
                chooseTxt.setColor('#FFFFFF');
            });
            btn.on('pointerdown', () => {
                opt.apply();

                // Destroy all menu elements first
                menuElements.forEach(el => el.destroy());

                const updatedData = {
                    hasExplosiveBullets: this.hasExplosiveBullets,
                    hasDoubleShot: this.hasDoubleShot,
                    hasIframeAbility: this.hasIframeAbility,
                    score: this.score,
                    enemiesKilled: this.enemiesKilled,
                    bulletSpeedMultiplier: this.bulletSpeedMultiplier,
                    wave: this.wave + 1, // Increase Wave Number
                    playerHealth: this.playerHealth // Persist Health
                };

                this.physics.resume();
                this.scene.start('Play', updatedData);
            });
        });
    }

    spawnNewWave() {
        // Simple respawn logic to keep the game going
        const worldWidth = 8000;
        for (let i = 0; i < 10; i++) {
            const x = Phaser.Math.Between(this.player.x + 500, worldWidth - 500);
            const drone = this.enemies.create(x, Phaser.Math.Between(100, 400), 'enemy');
            drone.setTint(0x00FF00);
            drone.body.setAllowGravity(false);
            drone.body.setCollideWorldBounds(true);
            drone.body.setBounce(1, 1);
            drone.lastShot = 0;
            const angle = Math.random() * Math.PI * 2;
            drone.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
        }
    }

    takeDamage() {
        if (this.isImmune || this.isFlashing) return;
        
        this.playerHealth -= 1;
        this.scoreText.innerText = `SCORE: ${this.score} - WAVE: ${this.wave} - LIVES: ${this.playerHealth}`;
        
        if (this.playerHealth <= 0) {
            this.gameOver();
        } else {
            // Flash and brief immunity
            this.isFlashing = true;
            this.player.setAlpha(0.5);
            this.tweens.add({
                targets: this.player,
                alpha: 0.2,
                duration: 100,
                yoyo: true,
                repeat: 5,
                onComplete: () => {
                    this.player.setAlpha(1);
                    this.isFlashing = false;
                }
            });
            this.cameras.main.shake(200, 0.01);
        }
    }

    updateScore(val) {
        this.score += val;
        this.scoreText.innerText = `SCORE: ${this.score} - WAVE: ${this.wave} - LIVES: ${this.playerHealth}`;
        this.scoreText.parentElement.style.transform = 'scale(1.1)';
        setTimeout(() => this.scoreText.parentElement.style.transform = 'scale(1)', 100);
    }

    gameOver() {
        this.scene.start('GameOver', { score: this.score });
    }
}

class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOver');
    }
    init(data) {
        this.finalScore = data.score || 0;
    }
    create() {
        const { width, height } = this.scale;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

        this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
            fontFamily: 'Outfit', fontSize: '80px', fontWeight: '700', color: '#FF007F'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2, `FINAL SCORE: ${this.finalScore}`, {
            fontFamily: 'Outfit', fontSize: '32px', color: '#FFFFFF'
        }).setOrigin(0.5);

        const btn = this.add.container(width / 2, height / 2 + 100);
        const rect = this.add.rectangle(0, 0, 220, 60, 0x111111).setStrokeStyle(2, 0xFFFFFF, 0.5);
        const text = this.add.text(0, 0, 'PLAY AGAIN', {
            fontFamily: 'Outfit', fontSize: '20px', color: '#FFFFFF'
        }).setOrigin(0.5);

        btn.add([rect, text]).setSize(220, 60).setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => this.scene.start('Play'));
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#0a0a0c',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 1500 }, debug: false }
    },
    scene: [BootScene, MenuScene, PlayScene, GameOverScene]
};

const game = new Phaser.Game(config);
