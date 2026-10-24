export default function Loader({ text = 'Loading' }) {
  return (
    <div className="loader-wrap">
      <div className="loader" aria-label={text}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div className="text" key={i}><span>{text}</span></div>
        ))}
        <div className="line" />
      </div>
    </div>
  );
}

