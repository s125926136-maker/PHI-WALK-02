import React from 'react';

// Reusable Section Title
export const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <span className="text-[9px] text-stone-500 uppercase tracking-wider block font-bold mb-1.5">
    {title}
  </span>
);

// Reusable Checkbox
export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  desc?: string;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, desc, disabled = false }) => (
  <label className={`flex items-start gap-2.5 cursor-pointer group transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:text-white'}`}>
    <input 
      type="checkbox" 
      checked={checked} 
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 rounded border-stone-800 text-brand bg-stone-950 focus:ring-brand focus:ring-offset-stone-900 w-3.5 h-3.5 accent-brand cursor-pointer shrink-0 disabled:cursor-not-allowed"
    />
    <div className="flex flex-col">
      <span className="text-[10.5px] font-sans font-medium leading-tight">{label}</span>
      {desc && <span className="text-[8px] text-stone-500 leading-normal mt-0.5">{desc}</span>}
    </div>
  </label>
);

// Reusable Toggle Option Group (Radios styled as block labels)
export interface ToggleSwitchOption {
  id: string;
  name: string;
  desc?: string;
  active: boolean;
}

export interface ToggleSwitchProps {
  options: ToggleSwitchOption[];
  onSelect: (id: string) => void;
  radioName: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ options, onSelect, radioName }) => (
  <div className="flex flex-col gap-2.5">
    {options.map((opt) => (
      <label 
        key={opt.id} 
        className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-all ${
          opt.active 
            ? 'bg-brand/10 border-brand/50 text-white' 
            : 'bg-stone-900/20 border-stone-900 hover:bg-stone-900/40 hover:border-stone-800 text-stone-400'
        }`}
        onClick={() => onSelect(opt.id)}
      >
        <input 
          type="radio" 
          name={radioName}
          checked={opt.active}
          onChange={() => {}} // Handled by container click
          className="mt-0.5 rounded-full border-stone-800 text-brand bg-stone-950 focus:ring-brand w-3.5 h-3.5 accent-brand cursor-pointer shrink-0"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold font-sans">{opt.name}</span>
          {opt.desc && <span className="text-[8.5px] text-stone-500 leading-tight">{opt.desc}</span>}
        </div>
      </label>
    ))}
  </div>
);

// Reusable Slider
export interface SliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  accentClass?: string;
  minLabel?: string;
  maxLabel?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = '',
  accentClass = 'accent-brand',
  minLabel,
  maxLabel,
}) => (
  <div className="space-y-1.5 p-2.5 bg-stone-900/20 border border-stone-900 rounded-sm">
    <div className="flex justify-between items-center text-[10px] font-mono">
      <span className="text-stone-400">{label}</span>
      <span className="text-brand font-bold">{value}{suffix}</span>
    </div>
    <input 
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={`w-full ${accentClass} h-1 bg-stone-900 appearance-none cursor-pointer`}
    />
    {(minLabel || maxLabel) && (
      <div className="flex justify-between text-[8px] text-stone-500 font-mono mt-0.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    )}
  </div>
);
