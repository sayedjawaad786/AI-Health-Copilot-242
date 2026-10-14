"""
services/disclaimers.py - Multilingual medical disclaimer strings.

These are hardcoded server-side and ALWAYS overwrite whatever the LLM
produces in the disclaimer field, so the model can never alter them.

Translation note: the en text is the canonical source. hi/te/ta are
accurate translations verified against the source meaning.
"""


from app.schemas.health import SupportedLanguage

# ---------------------------------------------------------------------------
# Canonical disclaimer per language
# ---------------------------------------------------------------------------
# The text must convey:
#   1. AI-generated, for understanding records only.
#   2. Not medical advice / diagnosis / prescription.
#   3. Do not start/stop/change any medicine based on this.
#   4. If unwell or value is critical, contact doctor / hospital immediately.
# ---------------------------------------------------------------------------

DISCLAIMERS: dict[str, str] = {
    SupportedLanguage.en: (
        "This summary is AI-generated to help you understand your medical records. "
        "It is not medical advice, a diagnosis, or a substitute for a qualified doctor. "
        "Do not start, stop, or change any medicine based on this summary. "
        "If you feel unwell or a value is marked critical, "
        "contact your doctor or nearest hospital immediately."
    ),
    SupportedLanguage.hi: (
        "यह सारांश आपके चिकित्सा रिकॉर्ड को समझने में मदद करने के लिए AI द्वारा "
        "तैयार किया गया है। यह चिकित्सा सलाह, निदान या किसी योग्य डॉक्टर का विकल्प नहीं है। "
        "इस सारांश के आधार पर कोई भी दवा शुरू, बंद या परिवर्तित न करें। "
        "यदि आप अस्वस्थ महसूस करते हैं या कोई मान 'critical' (गंभीर) दर्शाया गया है, "
        "तो तुरंत अपने डॉक्टर या निकटतम अस्पताल से संपर्क करें।"
    ),
    SupportedLanguage.te: (
        "ఈ సారాంశం మీ వైద్య రికార్డులను అర్థం చేసుకోవడంలో సహాయపడటానికి AI ద్వారా "
        "రూపొందించబడింది. ఇది వైద్య సలహా, నిర్ధారణ లేదా అర్హత కలిగిన వైద్యుడికి ప్రత్యామ్నాయం కాదు. "
        "ఈ సారాంశం ఆధారంగా ఏ మందు అయినా ప్రారంభించవద్దు, ఆపవద్దు లేదా మార్చవద్దు. "
        "మీకు అనారోగ్యంగా అనిపిస్తే లేదా ఏదైనా విలువ 'critical' (విమర్శనాత్మకం) గా గుర్తించబడితే, "
        "వెంటనే మీ డాక్టర్ లేదా సమీప ఆసుపత్రిని సంప్రదించండి."
    ),
    SupportedLanguage.ta: (
        "இந்த சுருக்கம் உங்கள் மருத்துவ பதிவுகளை புரிந்துகொள்ள உதவுவதற்காக AI மூலம் "
        "உருவாக்கப்பட்டுள்ளது. இது மருத்துவ ஆலோசனை, நோய் கண்டறிதல் அல்லது தகுதிவாய்ந்த "
        "மருத்துவருக்கு மாற்றாக அல்ல. இந்த சுருக்கத்தின் அடிப்படையில் எந்த மருந்தையும் "
        "தொடங்கவோ, நிறுத்தவோ அல்லது மாற்றவோ வேண்டாம். உங்களுக்கு உடல் நலக்குறைவு "
        "இருந்தால் அல்லது ஏதாவது மதிப்பு 'critical' (தீவிரமான) என்று குறிக்கப்பட்டால், "
        "உடனடியாக உங்கள் மருத்துவர் அல்லது அருகிலுள்ள மருத்துவமனையை தொடர்பு கொள்ளுங்கள்."
    ),
}


def get_disclaimer(language: SupportedLanguage) -> str:
    """
    Return the hardcoded disclaimer for the given language.
    Falls back to English if the language is not found.
    """
    return DISCLAIMERS.get(language, DISCLAIMERS[SupportedLanguage.en])
