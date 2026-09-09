/**
 * Renders a player avatar. If an image URL (e.g. Google photo) is provided it
 * shows the image, otherwise it falls back to the first letter of the name.
 * Style/className come from the caller so it integrates with each game's own
 * avatar look.
 */
export default function UserAvatar({ name = "", avatar = "", className = "", style = {}, imgStyle = {}, fallback = "" }) {
  if (avatar) {
    return (
      <span className={className} style={{ ...style, overflow: "hidden", padding: 0 }}>
        <img
          src={avatar}
          alt={name || "avatar"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
            ...imgStyle,
          }}
        />
      </span>
    );
  }
  return <span className={className} style={style}>{name?.[0]?.toUpperCase() ?? fallback}</span>;
}
