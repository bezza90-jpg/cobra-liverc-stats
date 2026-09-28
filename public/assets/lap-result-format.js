// LiveRC repeats the average in responsive markup and appends a lap index to best times.
export function averageLapText(value) {
 const text=String(value ?? '').trim();
 const parts=text.split(/\s+/);
 return parts.length>1 && parts.every(p=>p===parts[0]) ? parts[0] : text;
}
export function fastestLapText(value) {
 const text=String(value ?? '').trim();
 const match=text.match(/^(\d+\.\d{3})\s*(\d+)$/);
 return match ? match[1]+' (lap '+Number(match[2])+')' : text;
}
