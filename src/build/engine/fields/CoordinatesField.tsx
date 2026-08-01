import type { CoordinatesAnswerValue } from "@/build/schema/answers";
import type { CoordinatesField as CoordinatesFieldDef } from "@/build/schema/playbook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_ERROR_CLASS, type FieldComponentProps } from "./types";

export function CoordinatesField({
  field,
  value,
  onChange,
  error,
}: FieldComponentProps<CoordinatesFieldDef>) {
  const current: Partial<CoordinatesAnswerValue> =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as CoordinatesAnswerValue)
      : {};

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      onChange({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy,
      });
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${field.key}-lat`}>Latitude</Label>
        <Input
          id={`${field.key}-lat`}
          type="number"
          value={current.lat ?? ""}
          onChange={(event) =>
            onChange({ ...current, lat: Number(event.target.value) } as CoordinatesAnswerValue)
          }
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`${field.key}-lng`}>Longitude</Label>
        <Input
          id={`${field.key}-lng`}
          type="number"
          value={current.lng ?? ""}
          onChange={(event) =>
            onChange({ ...current, lng: Number(event.target.value) } as CoordinatesAnswerValue)
          }
          className="mt-1"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="sm:col-span-2"
        onClick={useMyLocation}
      >
        Use my location
      </Button>
      {error && <p className={`sm:col-span-2 ${FIELD_ERROR_CLASS}`}>{error}</p>}
    </div>
  );
}
