const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function buildClientEmail({ nome, onboardingUrl, phone }) {
  const subject = "CLEANDGO – Prossimi step (PDF + Onboarding)";

  const text = `Gentile ${nome || "Cliente"},

Grazie per averci contattato.

In allegato trova la scheda del servizio CLEANDGO (cosa include il turnover e gli extra disponibili).

✅ Prossimo step (necessario): compili l’onboarding completo qui:
${onboardingUrl}

Così possiamo confermare in modo definitivo tempi, accessi e prezzo.

📞 Se preferisce, possiamo sentirci 5 minuti su WhatsApp/telefono:
${phone}

A presto,
CLEANDGO
Servizi strutturati per affitti brevi`;

  return { subject, text };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const data = JSON.parse(event.body || "{}");
    const company = (data.company || "").trim();
    const startedAt = Number(data.form_started_at || 0);
    const now = Date.now();

    if (company) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      };
    }

    if (!startedAt || now - startedAt < 3000) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      };
    }
    if (process.env.LEADS_WEBHOOK_URL) {
      await fetch(process.env.LEADS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
    }

await fetch(process.env.LEADS_WEBHOOK_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(data)
});

    const nome = (data.nome || "").trim();
    const email = (data.email || "").trim();
    const indirizzo = (data.indirizzo || "").trim();
    const tipologia = (data.tipologia || "").trim();
    const messaggio = (data.messaggio || "").trim();

    if (!email) {
      return { statusCode: 400, body: "Missing client email" };
    }

    const onboardingUrl = process.env.ONBOARDING_FORM_URL;
    const pdfUrl = process.env.SCHEDA_PDF_URL;
    const phone = process.env.CLEANDGO_PHONE || "+39 3793346947";
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const ownerEmail = process.env.OWNER_NOTIFY_EMAIL;

    if (!onboardingUrl) throw new Error("Missing env ONBOARDING_FORM_URL");
    if (!pdfUrl) throw new Error("Missing env SCHEDA_PDF_URL");
    if (!fromEmail) throw new Error("Missing env SENDGRID_FROM_EMAIL");

    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error("Cannot fetch PDF: " + pdfUrl);

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const { subject, text } = buildClientEmail({ nome, onboardingUrl, phone });

    const clientMsg = {
      to: email,
      from: fromEmail,
      subject,
      text,
      attachments: [
        {
          content: base64,
          filename: "CLEANDGO_Scheda_Servizio_Reset.pdf",
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    if (ownerEmail) {
      const ownerMsg = {
        to: ownerEmail,
        from: fromEmail,
        subject: `NUOVO LEAD – ${nome || "senza nome"} – ${tipologia || "n/d"}`,
        text: `Nuovo contatto dal sito.

Nome: ${nome || "-"}
Email: ${email}
Indirizzo: ${indirizzo || "-"}
Tipologia: ${tipologia || "-"}
Messaggio: ${messaggio || "-"}`,
      };

      await sgMail.send([clientMsg, ownerMsg]);
    } else {
      await sgMail.send(clientMsg);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("ERR", err?.response?.body || err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: err?.response?.body?.errors?.[0]?.message || err.message,
      }),
    };
  }
};