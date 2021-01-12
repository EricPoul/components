/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Directive,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {coerceBooleanProperty} from '@angular/cdk/coercion';
import {MatRipple, RippleAnimationConfig, RippleRef, RippleState} from '@angular/material/core';
import {MatSlider, MatSliderEvent} from './slider';
import {Thumb} from '@material/slider';
import {MatSliderThumb} from './slider-thumb';

@Directive({
  selector: '[thumb-knob]',
})
export class ThumbKnob implements AfterViewInit {
  private _thumb: Thumb;
  private _input: MatSliderThumb;

  private _focusRippleRef: RippleRef;
  private _activeRippleRef: RippleRef;

  private _showFocusRipple(): void {
    if (!this._isShowingRipple(this._focusRippleRef)) {
      this._focusRippleRef = this._showRipple({ enterDuration: 0, exitDuration: 0 });
    }
  }
  private _showActiveRipple(): void {
    if (!this._isShowingRipple(this._activeRippleRef)) {
      this._activeRippleRef = this._showRipple({ enterDuration: 225, exitDuration: 400 });
    }
  }
  private _hideFocusRipple(): void {
    // We need this check because the mouse out event gets fired immediately after drag start.
    if (this._slider.isInputFocused(this._thumb)) {
      return;
    }
    this._focusRippleRef?.fadeOut();
  }
  private _hideActiveRipple(): void {
    this._activeRippleRef?.fadeOut();
  }
  private _isShowingRipple(rippleRef?: RippleRef): boolean {
    return rippleRef?.state === RippleState.FADING_IN || rippleRef?.state === RippleState.VISIBLE;
  }
  private _showRipple(animation: RippleAnimationConfig): RippleRef {
    return this._ripple.launch({
      animation,
      centered: true,
      persistent: true,
    });
  }

  constructor(
    private _slider: MatSlider,
    private _ripple: MatRipple,
    private _elementRef: ElementRef,
    private _sliderThumbDecorator: MatSliderThumbDecorator,
    ) {
      this._ripple.radius = 25;
    }

  ngAfterViewInit() {
    this._thumb = this._sliderThumbDecorator.thumb;
    this._input = this._slider.getInput(this._thumb);

    this._slider.dragStart.subscribe((event: MatSliderEvent) => this._onDragStart(event));
    this._slider.dragEnd.subscribe((event: MatSliderEvent) => this._onDragEnd(event));

    this._input.focus.subscribe(() => this._showFocusRipple());
    this._input.blur.subscribe(() => this._hideFocusRipple());
  }

  private _onDragStart(event: MatSliderEvent): void {
    if (event.sliderThumb.thumb === this._thumb) {
      this._showFocusRipple();
      this._showActiveRipple();
    }
  }
  private _onDragEnd(event: MatSliderEvent): void {
    if (event.sliderThumb.thumb === this._thumb) {
      this._hideFocusRipple();
      this._hideActiveRipple();
    }
  }

  @HostListener('mouseover') onMouseOver(): void {
    this._showFocusRipple();
  }
  @HostListener('mouseout') onMouseOut(): void {
    this._hideFocusRipple();
  }

  getRootEl(): HTMLElement {
    return this._elementRef.nativeElement;
  }
}

/**
 * Handles displaying the slider knobs and their value indicators.
 */
@Component({
  selector: 'mat-slider-thumb',
  templateUrl: 'slider-thumb-decorator.html',
  host: {'class': 'mdc-slider__thumb'},
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MatRipple],
})
export class MatSliderThumbDecorator {
  /** Whether the slider is discrete. */
  @Input()
  get isDiscrete(): boolean { return this._isDiscrete; }
  set isDiscrete(v) { this._isDiscrete = coerceBooleanProperty(v); }
  private _isDiscrete = false;

  /** The text content of the value indicator for a discrete slider. */
  @Input()
  get valueIndicatorText(): string { return this._valueIndicatorText; }
  set valueIndicatorText(v: string) {
    this._valueIndicatorText = v;
    this._cdr.detectChanges();
  }
  private _valueIndicatorText: string;

  @Input() thumb: Thumb;

  /** The visible circle for the slider thumb. */
  @ViewChild(ThumbKnob) _knob: ThumbKnob;

  constructor(
    private _cdr: ChangeDetectorRef,
    private _elementRef: ElementRef<HTMLElement>,
    ) {}

  getRootEl() {
    return this._elementRef.nativeElement;
  }

  getKnobWidth() {
    return this._knob.getRootEl().getBoundingClientRect().width;
  }
}
