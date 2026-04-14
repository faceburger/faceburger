export default function AdminLoading() {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ height: "100%" }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid #E4E6EB",
          borderTopColor: "#1877F2",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
