/**
 * Farbwähler.
 *
 * Bietet die Pastellpalette als Kacheln an, jeweils mit deutschem Farbnamen.
 * Die gewählte Farbe wird über Rahmen, Häkchen und aria-checked markiert,
 * also nicht ausschließlich über Farbe. Vollständig per Tastatur bedienbar
 * (Radio-Gruppe mit Pfeiltasten).
 */

import type { AnnotationColorId } from '../domain/types';
import { annotationColors, NO_COLOR_NAME, getColorHex } from '../config/annotationColors';

export interface ColorPickerProps {
  selectedColorId: AnnotationColorId | null;
  onSelectColor: (colorId: AnnotationColorId | null) => void;
}

export function ColorPicker({ selectedColorId, onSelectColor }: ColorPickerProps) {
  return (
    <div
      className="color-picker"
      role="radiogroup"
      aria-label="Farbe"
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const options: Array<AnnotationColorId | null> = [
          null,
          ...annotationColors.map((color) => color.id),
        ];
        const currentIndex = options.indexOf(selectedColorId);
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + step + options.length) % options.length;
        onSelectColor(options[nextIndex]);
      }}
    >
      <ColorOption
        colorId={null}
        name={NO_COLOR_NAME}
        hex={null}
        isSelected={selectedColorId === null}
        onSelect={onSelectColor}
      />
      {annotationColors.map((color) => (
        <ColorOption
          key={color.id}
          colorId={color.id}
          name={color.name}
          hex={color.hex}
          isSelected={selectedColorId === color.id}
          onSelect={onSelectColor}
        />
      ))}
    </div>
  );
}

interface ColorOptionProps {
  colorId: AnnotationColorId | null;
  name: string;
  hex: string | null;
  isSelected: boolean;
  onSelect: (colorId: AnnotationColorId | null) => void;
}

function ColorOption({ colorId, name, hex, isSelected, onSelect }: ColorOptionProps) {
  const safeHex = getColorHex(colorId) ?? hex ?? null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabIndex={isSelected ? 0 : -1}
      className={isSelected ? 'color-option is-selected' : 'color-option'}
      onClick={() => onSelect(colorId)}
      title={name}
    >
      <span
        className={safeHex ? 'color-swatch' : 'color-swatch color-swatch-none'}
        style={safeHex ? { backgroundColor: safeHex } : undefined}
        aria-hidden="true"
      >
        {isSelected ? '✓' : ''}
      </span>
      <span className="color-name">{name}</span>
    </button>
  );
}
