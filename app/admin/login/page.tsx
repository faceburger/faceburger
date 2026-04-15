"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/regrubecaf/categories");
    } else {
      const data = await res.json();
      setError(data.error ?? "Erreur");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F0F2F5" }}>
      <div
        className="w-full"
        style={{ maxWidth: 360, background: "#ffffff", borderRadius: 12, border: "1px solid #E4E6EB", padding: 32 }}
      >
        <h1 className="font-bold text-center mb-6" style={{ fontSize: 22, color: "#1877F2" }}>
          FaceBurger Admin
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            className="w-full outline-none"
            style={{ height: 48, border: "1px solid #E4E6EB", borderRadius: 8, padding: "0 12px", fontSize: 15 }}
          />
          {error && <p style={{ fontSize: 13, color: "#E53935" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold text-white disabled:opacity-60"
            style={{ height: 48, background: "#1877F2", borderRadius: 8, fontSize: 16 }}
          >
            {loading ? "..." : "Se connecter"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full text-center mt-4 text-sm"
          style={{ color: "#65676B", background: "none", border: "none", cursor: "pointer" }}
        >
          Mot de passe oublié ?
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full"
            style={{ maxWidth: 400, background: "#ffffff", borderRadius: 14, padding: 28, position: "relative" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "#65676B" }}
            >
              <X size={18} />
            </button>

            <h2 className="font-bold mb-1" style={{ fontSize: 17, color: "#1C1E21" }}>Récupérer le mot de passe</h2>
            <p className="mb-5 text-sm" style={{ color: "#65676B" }}>Étapes pour récupérer l'accès :</p>

            <div className="flex flex-col gap-4">
              {[
                { step: "1", text: "Connectez-vous sur", highlight: "vercel.com", end: "avec le compte faceburger05@gmail.com." },
                { step: "2", text: "Ouvrez le projet, allez dans", highlight: "Paramètres → Environment Variables" },
                { step: "3", text: "Cherchez la variable", highlight: "ADMIN_PASSWORD", end: "— sa valeur est votre mot de passe." },
              ].map(({ step, text, highlight, end }) => (
                <div key={step} className="flex gap-3 items-start">
                  <div className="shrink-0 flex items-center justify-center rounded-full font-bold text-white text-xs" style={{ width: 24, height: 24, background: "#1877F2" }}>
                    {step}
                  </div>
                  <p className="text-sm leading-snug" style={{ color: "#1C1E21" }}>
                    {text}{" "}
                    {highlight && <code className="rounded px-1 py-0.5 text-xs font-bold" style={{ background: "#EBF3FF", color: "#1877F2" }}>{highlight}</code>}
                    {end && <> {end}</>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
