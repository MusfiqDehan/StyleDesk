"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

const subscribe = () => () => {};
const choices = [
  { value: "light", label: "Light", description: "A bright, fresh workspace", Icon: Sun },
  { value: "dark", label: "Dark", description: "A softer view after hours", Icon: Moon },
  { value: "system", label: "System", description: "Follow your device appearance", Icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const selected = choices.find(choice => choice.value === (mounted ? theme : "system")) ?? choices[2];
  const Icon = selected.Icon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="theme-toggle" aria-label={`Color theme: ${selected.label}`}>
          <Icon size={16} aria-hidden="true" />
          <span>{selected.label}</span>
          <ChevronDown size={13} className="theme-chevron" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="theme-menu" align="end" sideOffset={10} collisionPadding={12}>
          <DropdownMenu.Label className="theme-menu-label">Appearance</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={selected.value} onValueChange={setTheme} aria-label="Color theme">
            {choices.map(({ value, label, description, Icon: OptionIcon }) => (
              <DropdownMenu.RadioItem className="theme-menu-option" value={value} key={value}>
                <span className="theme-option-icon"><OptionIcon size={18} aria-hidden="true" /></span>
                <span className="theme-option-copy"><strong>{label}</strong><small>{description}</small></span>
                <DropdownMenu.ItemIndicator className="theme-option-check"><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
