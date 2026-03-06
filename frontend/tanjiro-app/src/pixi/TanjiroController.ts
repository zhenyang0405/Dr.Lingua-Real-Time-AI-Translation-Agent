import { Container, AnimatedSprite, Texture, Rectangle, Assets, Application, FederatedPointerEvent, FederatedWheelEvent, Text, Graphics } from 'pixi.js';
import { ANIMATIONS } from './spriteConfig';

const CROSSFADE_FRAMES = 10;

export class TanjiroController {
  private container: Container;
  private sprites: Map<string, AnimatedSprite> = new Map();
  private currentState: string = 'blink';
  private app: Application;
  private lastWidth = 0;
  private lastHeight = 0;
  private blinkTimeout: number | null = null;
  private talkingTimeout: number | null = null;
  private thinkingTimeout: number | null = null;
  private isTalking = false;
  private isThinking = false;

  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  private customPosition = false;
  private customScale: number | null = null;

  private bubbleContainer = new Container();
  private bubbleBg = new Graphics();
  private bubbleText = new Text({
    text: '',
    style: {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0x000000,
      wordWrap: true,
      wordWrapWidth: 400,
      align: 'center',
    }
  });
  private textClearTimeout: number | null = null;
  private currentText = '';

  constructor(app: Application, container: Container) {
    this.app = app;
    this.container = container;

    this.bubbleContainer.addChild(this.bubbleBg);
    this.bubbleContainer.addChild(this.bubbleText);
    this.bubbleContainer.visible = false;
    this.container.addChild(this.bubbleContainer);
  }

  async loadAnimations(): Promise<void> {
    for (const [name, def] of Object.entries(ANIMATIONS)) {
      const texture = await Assets.load<Texture>(def.spriteSheet);
      texture.source.scaleMode = 'nearest';

      const frames: Texture[] = [];
      for (let i = 0; i < def.frameCount; i++) {
        const x = def.frameOffsets ? def.frameOffsets[i] : i * (def.frameWidth + (def.gap ?? 0));
        const frame = new Rectangle(x, 0, def.frameWidth, def.frameHeight);
        const frameTex = new Texture({
          source: texture.source,
          frame,
          label: `${name}_frame_${i}`,
        });
        frames.push(frameTex);
      }

      const sprite = new AnimatedSprite(frames);
      sprite.animationSpeed = def.animationSpeed;
      sprite.loop = def.loop;
      sprite.anchor.set(def.anchorX ?? 0.5, 1);
      sprite.visible = false;
      this.container.addChild(sprite);
      this.sprites.set(name, sprite);
    }

    this.container.eventMode = 'dynamic';
    this.container.cursor = 'pointer';
    this.container.on('pointerdown', this.onDragStart.bind(this));
    this.container.on('globalpointermove', this.onDragMove.bind(this));
    this.container.on('pointerup', this.onDragEnd.bind(this));
    this.container.on('pointerupoutside', this.onDragEnd.bind(this));
    this.container.on('wheel', this.onWheel.bind(this));

    this.positionCharacter();

    this.app.ticker.add(() => {
      const { width, height } = this.app.screen;
      if (width !== this.lastWidth || height !== this.lastHeight) {
        this.positionCharacter();
      }
    });

    const idleSprite = this.sprites.get('idle');
    if (idleSprite) {
      idleSprite.visible = true;
      idleSprite.play();
    }
    const blinkSprite = this.sprites.get('blink');
    if (blinkSprite) {
      blinkSprite.visible = true;
      blinkSprite.onComplete = () => {
        this.blinkTimeout = window.setTimeout(() => {
          blinkSprite.gotoAndPlay(0);
        }, 3000);
      };
      blinkSprite.play();
    }
  }

  private positionCharacter(): void {
    const { width, height } = this.app.screen;
    this.lastWidth = width;
    this.lastHeight = height;

    if (!this.customPosition) {
      this.container.x = width / 2;
      this.container.y = height;
    }

    const targetHeight = height * 0.4;
    const def = ANIMATIONS[this.currentState] ?? ANIMATIONS.blink;
    const scale = this.customScale !== null ? this.customScale : (targetHeight / def.frameHeight);
    this.container.scale.set(scale);
  }

  private onWheel(event: FederatedWheelEvent): void {
    const scaleStep = 0.05;
    const currentScale = this.container.scale.x;
    
    // Determine scroll direction
    // event.deltaY > 0 means scrolling down (zoom out)
    // event.deltaY < 0 means scrolling up (zoom in)
    const newScale = event.deltaY > 0 
      ? Math.max(0.1, currentScale - scaleStep) 
      : Math.min(3.0, currentScale + scaleStep);

    this.customScale = newScale;
    this.positionCharacter();
  }

  private onDragStart(event: FederatedPointerEvent): void {
    this.dragging = true;
    const parent = this.container.parent;
    if (!parent) return;
    const position = event.getLocalPosition(parent);
    this.dragOffset.x = this.container.x - position.x;
    this.dragOffset.y = this.container.y - position.y;
    this.customPosition = true;
  }

  private onDragMove(event: FederatedPointerEvent): void {
    if (this.dragging) {
      const parent = this.container.parent;
      if (!parent) return;
      const position = event.getLocalPosition(parent);
      this.container.x = position.x + this.dragOffset.x;
      this.container.y = position.y + this.dragOffset.y;
    }
  }

  private onDragEnd(): void {
    this.dragging = false;
  }

  transitionTo(state: string): void {
    if (state === this.currentState) return;
    const oldSprite = this.sprites.get(this.currentState);
    const newSprite = this.sprites.get(state);
    if (!newSprite) return;

    this.currentState = state;
    this.positionCharacter();

    newSprite.alpha = 0;
    newSprite.visible = true;
    newSprite.play();

    let frame = 0;
    const ticker = this.app.ticker;
    const onTick = () => {
      frame++;
      const t = Math.min(frame / CROSSFADE_FRAMES, 1);
      newSprite.alpha = t;
      if (oldSprite) oldSprite.alpha = 1 - t;

      if (t >= 1) {
        ticker.remove(onTick);
        if (oldSprite) {
          oldSprite.visible = false;
          oldSprite.stop();
          oldSprite.alpha = 1;
        }
      }
    };
    ticker.add(onTick);
  }

  private updateBubble() {
    if (!this.currentText) {
      this.bubbleContainer.visible = false;
      return;
    }
    
    this.bubbleText.text = this.currentText;
    const padding = 20;
    const width = this.bubbleText.width + padding * 2;
    const height = this.bubbleText.height + padding * 2;
    
    this.bubbleBg.clear();
    this.bubbleBg.roundRect(0, 0, width, height, 16);
    this.bubbleBg.fill({ color: 0xffffff, alpha: 0.9 });
    
    // Add a little tail to the bubble
    this.bubbleBg.moveTo(width / 2 - 10, height);
    this.bubbleBg.lineTo(width / 2, height + 15);
    this.bubbleBg.lineTo(width / 2 + 10, height);
    this.bubbleBg.fill({ color: 0xffffff, alpha: 0.9 });
    
    this.bubbleText.x = padding;
    this.bubbleText.y = padding;
    
    // Position bubble above character (adjusting for character scaling)
    this.bubbleContainer.x = -width / 2;
    const def = ANIMATIONS[this.currentState] ?? ANIMATIONS.blink;
    this.bubbleContainer.y = -def.frameHeight - height;
    
    this.bubbleContainer.visible = true;
  }

  addText(text: string): void {
    // Cancel any pending clear when new text arrives
    if (this.textClearTimeout !== null) {
      clearTimeout(this.textClearTimeout);
      this.textClearTimeout = null;
    }

    if (!this.currentText) {
      this.currentText = text;
    } else {
      this.currentText += text;
    }

    if (this.currentText.length > 300) {
      this.currentText = this.currentText.slice(this.currentText.length - 300);
    }

    this.updateBubble();
  }

  setText(text: string): void {
    this.currentText = text;

    if (this.currentText.length > 300) {
      this.currentText = this.currentText.slice(this.currentText.length - 300);
    }

    this.updateBubble();
  }

  scheduleClear(delay: number): void {
    if (this.textClearTimeout !== null) {
      clearTimeout(this.textClearTimeout);
    }
    this.textClearTimeout = window.setTimeout(() => {
      this.clearText();
    }, delay);
  }

  clearText(): void {
    this.currentText = '';
    this.updateBubble();
  }

  private stopAll(): void {
    // Stop blink
    if (this.blinkTimeout !== null) {
      clearTimeout(this.blinkTimeout);
      this.blinkTimeout = null;
    }
    const blinkSprite = this.sprites.get('blink');
    if (blinkSprite) {
      blinkSprite.stop();
      blinkSprite.visible = false;
    }

    // Stop talking
    this.isTalking = false;
    if (this.talkingTimeout !== null) {
      clearTimeout(this.talkingTimeout);
      this.talkingTimeout = null;
    }
    const talkingSprite = this.sprites.get('talking');
    if (talkingSprite) {
      talkingSprite.stop();
      talkingSprite.visible = false;
      talkingSprite.onComplete = undefined;
    }

    // Stop thinking
    this.isThinking = false;
    if (this.thinkingTimeout !== null) {
      clearTimeout(this.thinkingTimeout);
      this.thinkingTimeout = null;
    }
    const thinkingSprite = this.sprites.get('thinking');
    if (thinkingSprite) {
      thinkingSprite.stop();
      thinkingSprite.visible = false;
      thinkingSprite.onComplete = undefined;
    }
  }

  private resumeBlink(): void {
    const blinkSprite = this.sprites.get('blink');
    if (blinkSprite) {
      blinkSprite.visible = true;
      blinkSprite.gotoAndPlay(0);
    }
  }

  setTalking(talking: boolean): void {
    if (talking === this.isTalking) return;

    this.stopAll();

    if (talking) {
      this.isTalking = true;
      const talkingSprite = this.sprites.get('talking');
      if (talkingSprite) {
        talkingSprite.visible = true;
        talkingSprite.onComplete = () => {
          this.talkingTimeout = window.setTimeout(() => {
            if (this.isTalking) talkingSprite.gotoAndPlay(0);
          }, 500);
        };
        talkingSprite.gotoAndPlay(0);
      }
    } else {
      this.resumeBlink();
    }
  }

  setThinking(thinking: boolean): void {
    if (thinking === this.isThinking) return;
    
    if (thinking) {
      this.clearText();
    }

    this.stopAll();

    if (thinking) {
      this.isThinking = true;
      const thinkingSprite = this.sprites.get('thinking');
      if (thinkingSprite) {
        thinkingSprite.visible = true;
        thinkingSprite.onComplete = () => {
          this.thinkingTimeout = window.setTimeout(() => {
            if (this.isThinking) thinkingSprite.gotoAndPlay(0);
          }, 1000);
        };
        thinkingSprite.gotoAndPlay(0);
      }
    } else {
      this.resumeBlink();
    }
  }

  playHappy(): void {
    this.stopAll();

    const happySprite = this.sprites.get('happy');
    if (happySprite) {
      let loops = 0;
      happySprite.visible = true;
      happySprite.onComplete = () => {
        loops++;
        if (loops < 2) {
          happySprite.gotoAndPlay(0);
        } else {
          happySprite.visible = false;
          happySprite.onComplete = undefined;
          this.resumeBlink();
        }
      };
      happySprite.gotoAndPlay(0);
    }
  }

  get current(): string {
    return this.currentState;
  }

  destroy(): void {
    if (this.blinkTimeout !== null) {
      clearTimeout(this.blinkTimeout);
    }
    if (this.talkingTimeout !== null) {
      clearTimeout(this.talkingTimeout);
    }
    if (this.thinkingTimeout !== null) {
      clearTimeout(this.thinkingTimeout);
    }
    this.sprites.forEach((sprite) => {
      sprite.stop();
      sprite.destroy();
    });
    this.sprites.clear();
  }
}
