export interface FormattedTime {
  /** Horas, sempre com dois dígitos. */
  hours: string;
  /** Minutos, sempre com dois dígitos. */
  minutes: string;
  /** Segundos, sempre com dois dígitos. */
  seconds: string;
  /** Centésimos, sempre com dois dígitos. */
  centiseconds: string;
}

/** Quebra um tempo em milissegundos nos campos usados pelo cronômetro. */
export function formatTime(ms: number): FormattedTime {
  const totalMs = Math.max(0, ms);
  const totalSeconds = Math.floor(totalMs / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hours: pad(Math.floor(totalSeconds / 3600)),
    minutes: pad(Math.floor((totalSeconds % 3600) / 60)),
    seconds: pad(totalSeconds % 60),
    centiseconds: pad(Math.floor((totalMs % 1000) / 10)),
  };
}

/** Achata os campos de um tempo formatado nos oito dígitos usados nos inputs. */
export function toTimerDigits(time: FormattedTime): string[] {
  return (time.hours + time.minutes + time.seconds + time.centiseconds).split("");
}

/** Converte os oito dígitos de um cronômetro (hh:mm:ss.cc) em milissegundos. */
export function parseTimerDigits(digits: string[]): number {
  const field = (from: number, to: number) => {
    const parsed = Number.parseInt(digits.slice(from, to).join(""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const hours = field(0, 2);
  const minutes = field(2, 4);
  const seconds = field(4, 6);
  const centiseconds = field(6, 8);
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10;
}
