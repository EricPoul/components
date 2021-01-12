/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  BooleanInput,
  coerceBooleanProperty,
  coerceNumberProperty,
  NumberInput,
} from '@angular/cdk/coercion';
import {Platform} from '@angular/cdk/platform';
import {DOCUMENT} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  Output,
  QueryList,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
} from '@angular/core';
import {CanColorCtor, mixinColor} from '@angular/material/core';
import {SpecificEventListener, EventType} from '@material/base';
import {MDCSliderAdapter, MDCSliderFoundation, Thumb, TickMark} from '@material/slider';
import {MatSliderThumb} from './slider-thumb';
import {MatSliderThumbDecorator} from './slider-thumb-decorator';

// Boilerplate for applying mixins to MatSlider.
/** @docs-private */
class MatSliderBase {
  constructor(public _elementRef: ElementRef<HTMLElement>) {}
}
const _MatSliderMixinBase:
    CanColorCtor &
    typeof MatSliderBase =
        mixinColor(MatSliderBase, 'primary');

/** A simple event emitted by the MatSlider component. */
export class MatSliderEvent {
  /** The MatSlider that changed. */
  source: MatSlider;

  /** The MatSliderThumb that changed. */
  thumb: MatSliderThumb;

  /** The new value of the source slider. */
  value: number | null;

  constructor(source: MatSlider, thumb: MatSliderThumb, value: number | null) {
    this.source = source;
    this.thumb = thumb;
    this.value = value;
  }
}

// TODO(wagnermaciel): Figure out what the MAT_SLIDER_VALUE_ACCESSOR did and add it back.

/**
 * Allows users to select from a range of values by moving the slider thumb. It is similar in
 * behavior to the native `<input type="range">` element.
 */
@Component({
  selector: 'mat-slider',
  templateUrl: 'slider.html',
  styleUrls: ['slider.css'],
  host: {
    'class': 'mat-mdc-slider mdc-slider',
    '[class.mdc-slider--range]': 'isRange',
    '[class.mdc-slider--disabled]': 'isDisabled',
    '[class.mdc-slider--discrete]': 'isDiscrete',
    '[class.mdc-slider--tick-marks]': 'hasTickMarks',
  },
  exportAs: 'matSlider',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [],
  inputs: ['color'],
})
export class MatSlider extends _MatSliderMixinBase implements AfterViewInit, OnDestroy {

  // ************************* //
  // View and content children //
  // ************************* //

  /** The visual slider thumb(s). */
  @ViewChildren(MatSliderThumbDecorator) _thumbs: QueryList<MatSliderThumbDecorator>;
  private get thumbs(): MatSliderThumbDecorator[] { return this._thumbs?.toArray(); }

  /** The active section of the slider track. */
  @ViewChild('trackActive') _trackActive: ElementRef<HTMLElement>;
  get trackActive(): HTMLElement { return this._trackActive.nativeElement; }

  /** The hidden range inputs. */
  @ContentChildren(MatSliderThumb) _inputs: QueryList<MatSliderThumb>;
  private get inputs(): MatSliderThumb[] { return this._inputs ? this._inputs.toArray() : []; }

  // ****** //
  // Inputs //
  // ****** //

  /** Whether the slider is disabled. */
  @Input()
  get isDisabled(): boolean { return this._isDisabled; }
  set isDisabled(v: boolean) {
    this._isDisabled = coerceBooleanProperty(v);
    if (this.initialized) {
      this._foundation.setDisabled(v);
    }
  }
  private _isDisabled = false;

  /** Whether the slider displays a numeric value label upon pressing the thumb. */
  @Input()
  get isDiscrete(): boolean { return this._isDiscrete; }
  set isDiscrete(v) { this._isDiscrete = coerceBooleanProperty(v); }
  private _isDiscrete = false;

  /** Whether the slider displays tick marks along the slider track. */
  @Input()
  get hasTickMarks(): boolean { return this._hasTickMarks; }
  set hasTickMarks(v: boolean) { this._hasTickMarks = this.isDiscrete && coerceBooleanProperty(v); }
  private _hasTickMarks: boolean = false;

  /** The minimum value that the slider can have. */
  @Input()
  get min(): number { return this._min; }
  set min(v: number) { this._min = coerceNumberProperty(v, this._min); }
  private _min = 0;

  /** The maximum value that the slider can have. */
  @Input()
  get max(): number { return this._max; }
  set max(v: number) { this._max = coerceNumberProperty(v, this._max); }
  private _max = 100;

  /** The values at which the thumb will snap. */
  @Input()
  get step(): number { return this._step; }
  set step(v: number) { this._step = coerceNumberProperty(v, this._step); }
  private _step: number = 1;

  /**
   * Function that will be used to format the value before it is displayed
   * in the thumb label. Can be used to format very large number in order
   * for them to fit into the slider thumb.
   */
  @Input() displayWith: ((value: number) => string) | null;

  // ******* //
  // Outputs //
  // ******* //

  /** Event emitted when the slider value has changed. */
  @Output() readonly change: EventEmitter<MatSliderEvent> = new EventEmitter<MatSliderEvent>();

  /** Event emitted when the slider thumb moves. */
  @Output() readonly input: EventEmitter<MatSliderEvent> = new EventEmitter<MatSliderEvent>();

  /** Event emitted when the slider thumb starts being dragged. */
  @Output() readonly dragStart: EventEmitter<MatSliderEvent> = new EventEmitter<MatSliderEvent>();

  /** Event emitted when the slider thumb stops being dragged. */
  @Output() readonly dragEnd: EventEmitter<MatSliderEvent> = new EventEmitter<MatSliderEvent>();


  // *************** //
  // Class variables //
  // *************** //

  /** Instance of the MDC slider foundation for this slider. */
  private _foundation: MDCSliderFoundation = new MDCSliderFoundation(new SliderAdapter(this));

  /** Used to keep track of & render the active & inactive tick marks on the slider track. */
  get tickMarks(): TickMark[] { return this._tickMarks; }
  set tickMarks(v: TickMark[]) {
    this._tickMarks = v;
    this._cdr.detectChanges();
  }
  private _tickMarks: TickMark[];

  /** Whether the foundation has been initialized. */
  initialized: boolean = false;

  /** Whether this is a ranged slider. */
  get isRange(): boolean { return this.inputs.length === 2; }

  /** The text representation of the start inputs value. */
  get startValueIndicatorText() {
    const value = this.getValue(Thumb.START) ?? this.min;
    return this._getValueIndicatorText(value);
  }

  /** The text representation of the end inputs value. */
  get endValueIndicatorText() {
    const value = this.getValue(Thumb.END) ?? this.max;
    return this._getValueIndicatorText(value);
  }

  // ************** //
  // Public methods //
  // ************** //

  getRootEl() {
    return this._elementRef.nativeElement;
  }
  getValue(thumb: Thumb): number {
    return this.getInput(thumb).value;
  }
  setValue(value: number, thumb: Thumb) {
    if (thumb === Thumb.START) {
      this._foundation.setValueStart(value);
    } else {
      this._foundation.setValue(value);
    }
  }
  getTickMarkClass(tickMark: TickMark) {
    return tickMark === TickMark.ACTIVE
      ? 'mdc-slider__tick-mark--active'
      : 'mdc-slider__tick-mark--inactive';
  }
  emitChangeEvent(value: number, thumb: Thumb) {
    this.change.emit(this._createEvent(value, thumb));
  }
  emitInputEvent(value: number, thumb: Thumb) {
    this.input.emit(this._createEvent(value, thumb));
  }
  emitDragStartEvent(value: number, thumb: Thumb) {
    this.dragStart.emit(this._createEvent(value, thumb));
  }
  emitDragEndEvent(value: number, thumb: Thumb) {
    this.dragEnd.emit(this._createEvent(value, thumb));
  }
  getDocument() {
    return this._document;
  }
  getWindow() {
    return this._document.defaultView || window;
  }
  getThumb(thumb: Thumb): MatSliderThumbDecorator {
    return thumb === Thumb.END ? this.thumbs[this.thumbs.length - 1] : this.thumbs[0];
  }
  getThumbEl(thumb: Thumb): HTMLElement {
    return this.getThumb(thumb).getRootEl();
  }
  getInput(thumb: Thumb): MatSliderThumb {
    return thumb === Thumb.END ? this.inputs[this.inputs.length - 1] : this.inputs[0];
  }
  getInputEl(thumb: Thumb): HTMLInputElement {
    return this.getInput(thumb).getRootEl();
  }

  // *************** //
  // Private Methods //
  // *************** //

  private _getValueIndicatorText(value: number) {
    return this.displayWith ? this.displayWith(value) : value.toString();
  }
  private _createEvent(value: number, thumb: Thumb): MatSliderEvent {
    return new MatSliderEvent(this, this.getInput(thumb), value);
  }
  private _initInputs() {
    // Indicate to each of the inputs what thumb they correspond to.
    if (this.isRange) {
      this.inputs[0].thumb = Thumb.START;
      this.inputs[1].thumb = Thumb.END;
    } else {
      this.inputs[0].thumb = Thumb.END;
    }
    // Disable the slider inputs if this slider is disabled.
    if (this.isDisabled) {
      this.inputs.forEach(input => input.getRootEl().disabled = true);
    }
  }

  constructor(
    protected _cdr: ChangeDetectorRef,
    public _elementRef: ElementRef<HTMLElement>,
    protected _platform: Platform,
    @Inject(DOCUMENT) protected _document: any,
  ) {
    super(_elementRef);
  }

  ngAfterViewInit() {
    this.initialized = true;
    this._initInputs();
    this._foundation.init();
    if (this._platform.isBrowser) {
      this._foundation.layout();
    }
  }

  ngOnDestroy() {
    if (this._platform.isBrowser) {
      this._foundation.destroy();
    }
  }

  // The following lines of code enable us to provide a better developer experience by allowing a
  // more intuitive & less strict syntax for using the mat-slider. For example, without this the
  // following would be invalid:
  //
  // <mat-slider step="10" isDisabled>
  //   <input mat-slider-thumb>
  // </mat-slider>
  //
  // Because isDiscrete would technically be an empty string, normally a type error would be thrown.
  // The lines below allows this syntax and we can use coerceBooleanProperty to determine the
  // expected boolean value.
  //
  // Similarly, a type error would normally be thrown for step because a string is being provided.
  // We are again able to convert it to a number using coerceNumberProperty.

  static ngAcceptInputType_isDisabled: BooleanInput;
  static ngAcceptInputType_isDiscrete: BooleanInput;
  static ngAcceptInputType_hasTickMarks: BooleanInput;
  static ngAcceptInputType_min: NumberInput;
  static ngAcceptInputType_max: NumberInput;
  static ngAcceptInputType_step: NumberInput;
}

// TODO(wagnermaciel): Figure out why I need to declare the methods on SliderAdapter this way.
// * Object.assign(defaultAdapter, adapter) should return just adapter since it implements
// the same base class and therefore should have the same properties.
// * Object.keys(adapter) shows only `_delegate`. None of the classes show up.
// * Defining the methods like this makes them show up and makes Object.assign work as expected.

class SliderAdapter implements MDCSliderAdapter {
  constructor(private readonly _delegate: MatSlider) {}
  hasClass = (className: string): boolean => {
    return this._delegate.getRootEl().classList.contains(className);
  }
  addClass = (className: string): void => {
    this._delegate.getRootEl().classList.add(className);
  }
  removeClass = (className: string): void => {
    this._delegate.getRootEl().classList.remove(className);
  }
  getAttribute = (attribute: string): string | null => {
    return this._delegate.getRootEl().getAttribute(attribute);
  }
  addThumbClass = (className: string, thumb: Thumb): void => {
    this._delegate.getThumbEl(thumb).classList.add(className);
  }
  removeThumbClass = (className: string, thumb: Thumb): void => {
    this._delegate.getThumbEl(thumb).classList.remove(className);
  }
  getInputValue = (thumb: Thumb): string => {
    return this._delegate.getInputEl(thumb).value;
  }
  setInputValue = (value: string, thumb: Thumb): void => {
    this._delegate.getInput(thumb).value = coerceNumberProperty(value);
  }
  getInputAttribute = (attribute: string, thumb: Thumb): string | null => {
    return this._delegate.getInputEl(thumb).getAttribute(attribute);
  }
  setInputAttribute = (attribute: string, value: string, thumb: Thumb): void => {
    this._delegate.getInputEl(thumb).setAttribute(attribute, value);
  }
  removeInputAttribute = (attribute: string, thumb: Thumb): void => {
    this._delegate.getInputEl(thumb).removeAttribute(attribute);
  }
  focusInput = (thumb: Thumb): void => {
    this._delegate.getInputEl(thumb).focus();
  }
  isInputFocused = (thumb: Thumb): boolean => {
    return this._delegate.getInputEl(thumb) === this._delegate.getDocument().activeElement;
  }
  getThumbKnobWidth = (thumb: Thumb): number => {
    return this._delegate.getThumb(thumb).getKnobWidth();
  }
  getThumbBoundingClientRect = (thumb: Thumb): ClientRect => {
    return this._delegate.getThumbEl(thumb).getBoundingClientRect();
  }
  getBoundingClientRect = (): ClientRect => {
    return this._delegate.getRootEl().getBoundingClientRect();
  }
  isRTL = (): boolean => {
    return false;
    // TODO(wagnermaciel): DO NOT FORGET TO IMPLEMENT THIS.
    // throw new Error('Method not implemented.');
  }
  setThumbStyleProperty = (propertyName: string, value: string, thumb: Thumb): void => {
    this._delegate.getThumbEl(thumb).style.setProperty(propertyName, value);
  }
  removeThumbStyleProperty = (propertyName: string, thumb: Thumb): void => {
    this._delegate.getThumbEl(thumb).style.removeProperty(propertyName);
  }
  setTrackActiveStyleProperty = (propertyName: string, value: string): void => {
    this._delegate.trackActive.style.setProperty(propertyName, value);
  }
  removeTrackActiveStyleProperty = (propertyName: string): void => {
    this._delegate.trackActive.style.removeProperty(propertyName);
  }
  setValueIndicatorText = (value: number, thumb: Thumb): void => {
    this._delegate.getThumb(thumb).valueIndicatorText = value.toString();
  }
  getValueToAriaValueTextFn = (): ((value: number) => string) | null => {
    return this._delegate.displayWith;
  }
  updateTickMarks = (tickMarks: TickMark[]): void => {
    this._delegate.tickMarks = tickMarks;
  }
  setPointerCapture = (pointerId: number): void => {
    this._delegate.getRootEl().setPointerCapture(pointerId);
  }
  emitChangeEvent = (value: number, thumb: Thumb): void => {
    this._delegate.emitChangeEvent(value, thumb);
  }
  emitInputEvent = (value: number, thumb: Thumb): void => {
    this._delegate.emitInputEvent(value, thumb);
  }
  emitDragStartEvent = (value: number, thumb: Thumb): void => {
    this._delegate.emitDragStartEvent(value, thumb);
  }
  emitDragEndEvent = (value: number, thumb: Thumb): void => {
    this._delegate.emitDragEndEvent(value, thumb);
  }
  registerEventHandler = <K extends EventType>(evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getRootEl().addEventListener(evtType, handler);
  }
  deregisterEventHandler = <K extends EventType>(evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getRootEl().removeEventListener(evtType, handler);
  }
  registerThumbEventHandler = <K extends EventType>(thumb: Thumb, evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getThumbEl(thumb).addEventListener(evtType, handler);
  }
  deregisterThumbEventHandler = <K extends EventType>(thumb: Thumb, evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getThumbEl(thumb).removeEventListener(evtType, handler);
  }
  registerInputEventHandler = <K extends EventType>(thumb: Thumb, evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getInputEl(thumb).addEventListener(evtType, handler);
  }
  deregisterInputEventHandler = <K extends EventType>(thumb: Thumb, evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getInputEl(thumb).removeEventListener(evtType, handler);
  }
  registerBodyEventHandler = <K extends EventType>(evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getDocument().body.addEventListener(evtType, handler);
  }
  deregisterBodyEventHandler = <K extends EventType>(evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getDocument().body.removeEventListener(evtType, handler);
  }
  registerWindowEventHandler = <K extends EventType>(evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getWindow().addEventListener(evtType, handler);
  }
  deregisterWindowEventHandler = <K extends EventType>(evtType: K, handler: SpecificEventListener<K>): void => {
    this._delegate.getWindow().removeEventListener(evtType, handler);
  }
}
