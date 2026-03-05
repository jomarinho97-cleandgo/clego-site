// netlify/functions/send-client-email.js
const sgMail = require("@sendgrid/mail");

// Node 18+ em Netlify tem fetch nativo
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function buildClientEmail({ nome, onboardingUrl, phone }) {
  const subject = "CLEANDGO – Prossimi step (PDF + Onboarding)";

  const text =
`Gentile ${nome || "Cliente"},

grazie per averci contattato.

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
    const payload = JSON.parse(event.body || "{}");

    // Netlify Forms webhook costuma enviar payload.payload.data
    const data = payload?.payload?.data ? payload.payload.data : payload;

    const nome = (data?.nome || "").trim();
    const email = (data?.email || "").trim();
    const indirizzo = (data?.indirizzo || "").trim();
    const tipologia = (data?.tipologia || "").trim();
    const messaggio = (data?.messaggio || "").trim();

    if (!email) return { statusCode: 400, body: "Missing client email" };

    const onboardingUrl = process.env.ONBOARDING_FORM_URL;
    const pdfUrl = process.env.SCHEDA_PDF_URL;
    const phone = process.env.CLEANDGO_PHONE || "+39 3793346947";

    if (!onboardingUrl) throw new Error("Missing env ONBOARDING_FORM_URL");
    if (!pdfUrl) throw new Error("Missing env SCHEDA_PDF_URL");

    // Fetch PDF para anexar
    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error("Cannot fetch PDF: " + pdfUrl);
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const { subject, text } = buildClientEmail({ nome, onboardingUrl, phone });

    const clientMsg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
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

    // (Opcional) notificação para ti
    const ownerEmail = process.env.OWNER_NOTIFY_EMAIL;
    if (ownerEmail) {
      const ownerMsg = {
        to: ownerEmail,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: `NUOVO LEAD – ${nome || "senza nome"} – ${tipologia || "n/d"}`,
        text:
`Nuovo contatto dal sito.

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

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "ERROR: " + err.message };
  }
};