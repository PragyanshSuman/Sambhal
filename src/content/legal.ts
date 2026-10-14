// Long-form legal copy. Have a lawyer review before launch; these are a solid starting
// point aligned with the IT Rules 2021 and the DPDP Act 2023, not legal advice.

import type { Locale } from "@/i18n/config";

export type LegalSection = { heading: string; body: string[] };

export const operator = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME || "Sambhal",
  officer: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME || "[Grievance Officer name]",
  email: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || "grievance@example.com",
  address: process.env.NEXT_PUBLIC_GRIEVANCE_ADDRESS || "[Postal address in India]",
};

export const privacy: Record<Locale, { title: string; updated: string; sections: LegalSection[] }> = {
  en: {
    title: "Privacy notice",
    updated: "Last updated: October 2026",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Your email address or phone number, only to sign you in. It is never shown to anyone.",
          "The name and area you choose to show, and everything you post: reports, photos, comments, confirmations and RSVPs.",
          "If you become a helper: your skills, a base location and a radius. Others only ever see the distance, never the location.",
          "When you confirm or verify on the spot, your location once, to check you are within range. We store the distance, not your coordinates.",
          "Daily page view counts per page, with no cookies and no personal identifiers.",
        ],
      },
      {
        heading: "Why",
        body: [
          "To run the service: show problems on the map, route them to neighbours who can help, and keep the community process honest.",
          "We do not sell your data, show ads, or share it with anyone except the providers that host the service (Supabase for the database and storage, and our web host).",
        ],
      },
      {
        heading: "Photos",
        body: [
          "Photos are public. Before you post, Sambhal lets you blur faces and number plates on your device; nothing is uploaded until you choose to post.",
          "If a photo shows you, you can ask us to remove it through the grievance page.",
        ],
      },
      {
        heading: "Your rights under the DPDP Act, 2023",
        body: [
          "Access: download everything we hold about you from My activity → Your data.",
          "Correction: edit your name, area and helper details at any time.",
          "Erasure: delete your account from My activity. Your profile, photos, helper details and notifications are deleted. Reports and comments stay as community record without your name.",
          "Grievance: contact our Grievance Officer (details on the grievance page). You may also approach the Data Protection Board of India.",
        ],
      },
      {
        heading: "Retention",
        body: [
          "Account data is kept while your account exists. Notifications older than a year and rate-limit records older than two days are removed automatically.",
        ],
      },
      {
        heading: "Children",
        body: ["Sambhal is for people aged 18 and over. Don't post photos that identify children."],
      },
    ],
  },
  hi: {
    title: "निजता सूचना",
    updated: "अंतिम अपडेट: अक्टूबर 2026",
    sections: [
      {
        heading: "हम क्या जानकारी लेते हैं",
        body: [
          "आपका ईमेल या फ़ोन नंबर, सिर्फ़ साइन इन के लिए। यह किसी को नहीं दिखता।",
          "आपका चुना हुआ नाम और इलाका, और जो कुछ आप डालते हैं: रिपोर्ट, फ़ोटो, टिप्पणियाँ, पुष्टि और अभियान में हामी।",
          "अगर आप मददगार बनते हैं: आपके हुनर, आपकी जगह और दायरा। दूसरों को सिर्फ़ दूरी दिखती है, जगह कभी नहीं।",
          "मौके पर पुष्टि करते समय, एक बार आपकी लोकेशन, यह जाँचने के लिए कि आप पास हैं। हम दूरी सेव करते हैं, आपके निर्देशांक नहीं।",
          "हर पेज के रोज़ के व्यू की गिनती, बिना कुकी और बिना किसी निजी पहचान के।",
        ],
      },
      {
        heading: "क्यों",
        body: [
          "सेवा चलाने के लिए: समस्याएँ नक्शे पर दिखाना, उन्हें मदद कर सकने वाले पड़ोसियों तक पहुँचाना, और सामुदायिक प्रक्रिया को ईमानदार रखना।",
          "हम आपका डेटा नहीं बेचते, विज्ञापन नहीं दिखाते, और सेवा चलाने वाले प्रदाताओं (डेटाबेस और स्टोरेज के लिए Supabase, और हमारा वेब होस्ट) के अलावा किसी से साझा नहीं करते।",
        ],
      },
      {
        heading: "फ़ोटो",
        body: [
          "फ़ोटो सार्वजनिक होती हैं। भेजने से पहले संभाल आपको अपने डिवाइस पर ही चेहरे और नंबर प्लेट धुंधले करने देता है; भेजने तक कुछ भी अपलोड नहीं होता।",
          "अगर किसी फ़ोटो में आप हैं, तो शिकायत पेज से उसे हटाने को कह सकते हैं।",
        ],
      },
      {
        heading: "डीपीडीपी अधिनियम, 2023 के तहत आपके अधिकार",
        body: [
          "देखना: मेरी गतिविधि → आपका डेटा से अपनी सारी जानकारी डाउनलोड करें।",
          "सुधार: अपना नाम, इलाका और मददगार जानकारी कभी भी बदलें।",
          "मिटाना: मेरी गतिविधि से अपना खाता मिटाएँ। आपकी प्रोफ़ाइल, फ़ोटो, मददगार जानकारी और सूचनाएँ मिट जाती हैं। रिपोर्ट और टिप्पणियाँ बिना आपके नाम के समुदाय के रिकॉर्ड के रूप में रहती हैं।",
          "शिकायत: हमारे शिकायत अधिकारी से संपर्क करें (विवरण शिकायत पेज पर)। आप भारतीय डेटा संरक्षण बोर्ड से भी संपर्क कर सकते हैं।",
        ],
      },
      {
        heading: "कितने समय तक",
        body: ["खाते की जानकारी तब तक रहती है जब तक खाता है। साल भर पुरानी सूचनाएँ और दो दिन पुराने रेट-लिमिट रिकॉर्ड अपने आप हट जाते हैं।"],
      },
      {
        heading: "बच्चे",
        body: ["संभाल 18 वर्ष और उससे अधिक उम्र के लोगों के लिए है। बच्चों की पहचान करने वाली फ़ोटो न डालें।"],
      },
    ],
  },
};

export const terms: Record<Locale, { title: string; updated: string; sections: LegalSection[] }> = {
  en: {
    title: "Community rules",
    updated: "Last updated: October 2026",
    sections: [
      {
        heading: "What Sambhal is for",
        body: [
          "Problems in shared spaces that neighbours can deal with together: streets, drains, parks, footpaths, public facilities.",
          "Not for private disputes, complaints about specific people, or political campaigning.",
        ],
      },
      {
        heading: "Be safe",
        body: [
          "Never touch live wires, enter drains or manholes, climb trees, or work in moving traffic. Call emergency services (112) for anything dangerous.",
          "Cleanup drives are organised by residents, not by Sambhal. Take part at your own risk and look after each other.",
        ],
      },
      {
        heading: "Be fair",
        body: [
          "No blaming, naming or shaming individuals, officials included. Describe the problem, not the person.",
          "Blur faces and number plates. Don't post anyone's phone number, address or other personal details.",
          "Only confirm or verify what you have seen yourself, on the spot.",
          "Never collect money from strangers through Sambhal. Buy materials together and post receipts.",
        ],
      },
      {
        heading: "What we remove",
        body: [
          "Content that is unlawful under Indian law, harassing, hateful, sexually explicit, misleading, or that invades someone's privacy, as set out in Rule 3(1)(b) of the IT Rules, 2021.",
          "Anyone can flag content. After three flags it is hidden until a moderator reviews it. Repeated or serious violations lead to suspension.",
          "If you disagree with a decision, write to the Grievance Officer.",
        ],
      },
      {
        heading: "Your content",
        body: [
          "You keep ownership of what you post. You give Sambhal permission to display it publicly on the service and in shared previews.",
        ],
      },
      {
        heading: "No guarantees",
        body: [
          "Sambhal is a community tool provided as is. It is not an emergency service and not a government channel. Information is posted by residents and may be wrong.",
        ],
      },
    ],
  },
  hi: {
    title: "समुदाय के नियम",
    updated: "अंतिम अपडेट: अक्टूबर 2026",
    sections: [
      {
        heading: "संभाल किसलिए है",
        body: [
          "साझा जगहों की वे समस्याएँ जिन्हें पड़ोसी मिलकर सुलझा सकते हैं: सड़कें, नालियाँ, पार्क, फ़ुटपाथ, सार्वजनिक सुविधाएँ।",
          "निजी झगड़ों, किसी ख़ास व्यक्ति की शिकायत, या राजनीतिक प्रचार के लिए नहीं।",
        ],
      },
      {
        heading: "सुरक्षित रहें",
        body: [
          "बिजली के तार न छुएँ, नाली या मैनहोल में न उतरें, पेड़ों पर न चढ़ें, और चलते ट्रैफ़िक में काम न करें। ख़तरनाक चीज़ों के लिए आपातकालीन सेवा (112) को फ़ोन करें।",
          "सफ़ाई अभियान निवासी आयोजित करते हैं, संभाल नहीं। अपनी ज़िम्मेदारी पर हिस्सा लें और एक-दूसरे का ध्यान रखें।",
        ],
      },
      {
        heading: "निष्पक्ष रहें",
        body: [
          "किसी व्यक्ति को, अफ़सरों को भी, दोष न दें, नाम न लें, शर्मिंदा न करें। समस्या बताएँ, व्यक्ति नहीं।",
          "चेहरे और नंबर प्लेट धुंधले करें। किसी का फ़ोन नंबर, पता या अन्य निजी जानकारी न डालें।",
          "सिर्फ़ वही पुष्टि करें जो आपने खुद मौके पर देखा हो।",
          "संभाल के ज़रिए अनजान लोगों से कभी पैसा न जुटाएँ। सामान मिलकर ख़रीदें और रसीदें डालें।",
        ],
      },
      {
        heading: "हम क्या हटाते हैं",
        body: [
          "ऐसी सामग्री जो भारतीय क़ानून के तहत ग़ैरक़ानूनी, परेशान करने वाली, नफ़रत भरी, अश्लील, भ्रामक हो, या किसी की निजता में दख़ल दे, जैसा आईटी नियम, 2021 के नियम 3(1)(b) में बताया गया है।",
          "कोई भी सामग्री की रिपोर्ट कर सकता है। तीन रिपोर्ट के बाद, मॉडरेटर की समीक्षा तक वह छिप जाती है। बार-बार या गंभीर उल्लंघन पर खाता निलंबित होता है।",
          "किसी फ़ैसले से असहमत हों तो शिकायत अधिकारी को लिखें।",
        ],
      },
      {
        heading: "आपकी सामग्री",
        body: ["आप जो डालते हैं, वह आपका रहता है। आप संभाल को इसे सेवा पर और शेयर किए गए प्रीव्यू में सार्वजनिक रूप से दिखाने की अनुमति देते हैं।"],
      },
      {
        heading: "कोई गारंटी नहीं",
        body: [
          "संभाल एक सामुदायिक साधन है, जैसा है वैसा। यह आपातकालीन सेवा या सरकारी माध्यम नहीं है। जानकारी निवासी डालते हैं और ग़लत हो सकती है।",
        ],
      },
    ],
  },
};
