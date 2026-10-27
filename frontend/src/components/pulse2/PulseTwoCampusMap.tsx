import { useMemo } from "react";
import { geoAlbersUsa } from "d3-geo";
import { COLLEGES } from "../../data/colleges";
import dots from "../../pages/pulse2/us-dots.json";

const project = () =>
  geoAlbersUsa().scale(dots.scale).translate(dots.translate as [number, number]);

export default function PulseTwoCampusMap() {
  const pins = useMemo(() => {
    const geo = project();
    return COLLEGES.flatMap((college) => {
      const xy = geo([college.lng, college.lat]);
      if (!xy) return [];
      return [
        {
          name: college.name,
          domain: college.domain,
          left: `${(xy[0] / dots.width) * 100}%`,
          top: `${(xy[1] / dots.height) * 100}%`,
        },
      ];
    });
  }, []);

  return (
    <div className="pulse2-map">
      <svg
        className="pulse2-map__land"
        viewBox={`0 0 ${dots.width} ${dots.height}`}
        role="img"
        aria-label="United States"
      >
        {dots.points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={dots.r} />
        ))}
      </svg>
      <div className="pulse2-map__pins">
        {pins.map((pin) => (
          <button
            key={pin.domain}
            type="button"
            className="pulse2-map__pin"
            style={{ left: pin.left, top: pin.top }}
            aria-label={pin.name}
          >
            <span>{pin.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
