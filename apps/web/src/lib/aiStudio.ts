/**
 * AI studio constants for the web create page — mirrors the mobile app's
 * writer (languages, tones, styles) so both surfaces speak the same menu.
 */

export interface WriterLanguage {
  id: string;
  label: string;
}

export const WRITER_LANGUAGES: WriterLanguage[] = [
  { id: 'English', label: 'English' },
  { id: 'Bahasa Melayu', label: 'Melayu' },
  { id: '中文', label: '中文' },
  { id: 'Tamil', label: 'Tamil' },
  { id: 'Afrikaans', label: 'Afrikaans' },
  { id: 'Albanian', label: 'Shqip' },
  { id: 'Amharic', label: 'አማርኛ' },
  { id: 'Arabic', label: 'العربية' },
  { id: 'Armenian', label: 'Հայերեն' },
  { id: 'Azerbaijani', label: 'Azərbaycanca' },
  { id: 'Basque', label: 'Euskara' },
  { id: 'Belarusian', label: 'Беларуская' },
  { id: 'Bengali', label: 'বাংলা' },
  { id: 'Bosnian', label: 'Bosanski' },
  { id: 'Bulgarian', label: 'Български' },
  { id: 'Burmese', label: 'မြန်မာ' },
  { id: 'Cantonese', label: 'Cantonese' },
  { id: 'Catalan', label: 'Català' },
  { id: 'Cebuano', label: 'Cebuano' },
  { id: 'Czech', label: 'Čeština' },
  { id: 'Danish', label: 'Dansk' },
  { id: 'Dutch', label: 'Nederlands' },
  { id: 'Esperanto', label: 'Esperanto' },
  { id: 'Estonian', label: 'Eesti' },
  { id: 'Filipino', label: 'Filipino' },
  { id: 'Finnish', label: 'Suomi' },
  { id: 'French', label: 'Français' },
  { id: 'Galician', label: 'Galego' },
  { id: 'Georgian', label: 'ქართული' },
  { id: 'German', label: 'Deutsch' },
  { id: 'Greek', label: 'Ελληνικά' },
  { id: 'Gujarati', label: 'ગુજરાતી' },
  { id: 'Haitian Creole', label: 'Kreyòl' },
  { id: 'Hausa', label: 'Hausa' },
  { id: 'Hebrew', label: 'עברית' },
  { id: 'Hindi', label: 'हिन्दी' },
  { id: 'Hungarian', label: 'Magyar' },
  { id: 'Icelandic', label: 'Íslenska' },
  { id: 'Igbo', label: 'Igbo' },
  { id: 'Indonesian', label: 'Bahasa Indonesia' },
  { id: 'Irish', label: 'Gaeilge' },
  { id: 'Italian', label: 'Italiano' },
  { id: 'Japanese', label: '日本語' },
  { id: 'Javanese', label: 'Basa Jawa' },
  { id: 'Kannada', label: 'ಕನ್ನಡ' },
  { id: 'Kazakh', label: 'Қазақша' },
  { id: 'Khmer', label: 'ខ្មែរ' },
  { id: 'Korean', label: '한국어' },
  { id: 'Kurdish', label: 'Kurdî' },
  { id: 'Kyrgyz', label: 'Кыргызча' },
  { id: 'Lao', label: 'ລາວ' },
  { id: 'Latin', label: 'Latin' },
  { id: 'Latvian', label: 'Latviešu' },
  { id: 'Lithuanian', label: 'Lietuvių' },
  { id: 'Macedonian', label: 'Македонски' },
  { id: 'Malagasy', label: 'Malagasy' },
  { id: 'Malayalam', label: 'മലയാളം' },
  { id: 'Maltese', label: 'Malti' },
  { id: 'Maori', label: 'Te Reo Māori' },
  { id: 'Marathi', label: 'मराठी' },
  { id: 'Mongolian', label: 'Монгол' },
  { id: 'Nepali', label: 'नेपाली' },
  { id: 'Norwegian', label: 'Norsk' },
  { id: 'Pashto', label: 'پښتو' },
  { id: 'Persian', label: 'فارسی' },
  { id: 'Polish', label: 'Polski' },
  { id: 'Portuguese', label: 'Português' },
  { id: 'Punjabi', label: 'ਪੰਜਾਬੀ' },
  { id: 'Quechua', label: 'Quechua' },
  { id: 'Romanian', label: 'Română' },
  { id: 'Russian', label: 'Русский' },
  { id: 'Samoan', label: 'Gagana Samoa' },
  { id: 'Serbian', label: 'Српски' },
  { id: 'Shona', label: 'chiShona' },
  { id: 'Sinhala', label: 'සිංහල' },
  { id: 'Slovak', label: 'Slovenčina' },
  { id: 'Slovenian', label: 'Slovenščina' },
  { id: 'Somali', label: 'Soomaali' },
  { id: 'Spanish', label: 'Español' },
  { id: 'Sundanese', label: 'Basa Sunda' },
  { id: 'Swahili', label: 'Kiswahili' },
  { id: 'Swedish', label: 'Svenska' },
  { id: 'Tajik', label: 'Тоҷикӣ' },
  { id: 'Telugu', label: 'తెలుగు' },
  { id: 'Thai', label: 'ไทย' },
  { id: 'Tibetan', label: 'བོད་སྐད་' },
  { id: 'Turkish', label: 'Türkçe' },
  { id: 'Turkmen', label: 'Türkmençe' },
  { id: 'Ukrainian', label: 'Українська' },
  { id: 'Urdu', label: 'اردو' },
  { id: 'Uyghur', label: 'ئۇيغۇرچە' },
  { id: 'Uzbek', label: 'Oʻzbek' },
  { id: 'Vietnamese', label: 'Tiếng Việt' },
  { id: 'Welsh', label: 'Cymraeg' },
  { id: 'Xhosa', label: 'isiXhosa' },
  { id: 'Yiddish', label: 'ייִדיש' },
  { id: 'Yoruba', label: 'Yorùbá' },
  { id: 'Zulu', label: 'isiZulu' },
];

export interface StudioTone {
  id: string;
  label: string;
}

export const STUDIO_TONES: StudioTone[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'story', label: 'Story' },
  { id: 'punchy', label: 'Punchy' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'professional', label: 'Pro' },
  { id: 'bold', label: 'Bold' },
];

export interface StudioStyle {
  id: string;
  label: string;
  hint: string;
  sample: string;
  sampleMs: string;
  sampleZh: string;
  sampleTa: string;
}

export const STUDIO_STYLES: StudioStyle[] = [
  { id: 'auto', label: 'Auto', hint: 'Pick the best fit',
    sample: 'The AI commits to whatever structure fits your idea best.',
    sampleMs: 'AI akan pilih struktur yang paling sesuai dengan idea anda.',
    sampleZh: 'AI 会为你的想法选择最合适的结构。',
    sampleTa: 'உங்கள் யோசனைக்கு ஏற்ற அமைப்பை AI தேர்ந்தெடுக்கும்.' },
  { id: 'breaking', label: 'Breaking', hint: 'Urgent news update',
    sample: 'JUST IN: Council passes the transit bill 7–2. It takes effect in March — here is what changes.',
    sampleMs: 'TERKINI: Majlis meluluskan rang undang-undang transit 7–2. Berkuat kuasa Mac — ini yang berubah.',
    sampleZh: '突发：市议会以7比2通过交通法案，三月生效——以下是变化。',
    sampleTa: 'அவசரம்: போக்குவரத்து மசோதா 7–2 என நிறைவேறியது. மார்ச் முதல் அமல் — மாற்றங்கள் இவை.' },
  { id: 'thread', label: 'Deep thread', hint: 'Story, one idea per post',
    sample: 'I wasted 2 years overthinking content. Here is the system that actually works:',
    sampleMs: 'Saya bazirkan 2 tahun fikir pasal kandungan. Ini sistem yang betul-betul berkesan:',
    sampleZh: '我花了两年时间纠结内容。这是真正有效的方法：',
    sampleTa: 'உள்ளடக்கத்தைப் பற்றி யோசித்து 2 ஆண்டுகளை வீணாக்கினேன். உண்மையில் வேலை செய்யும் முறை இது:' },
  { id: 'listicle', label: 'Listicle', hint: 'Saveable value stack',
    sample: '5 free tools that cut my editing time in half — save this:',
    sampleMs: '5 alat percuma yang potong separuh masa suntingan saya — simpan ini:',
    sampleZh: '5 个免费工具让我的剪辑时间减半——收藏：',
    sampleTa: 'எனது எடிட்டிங் நேரத்தை பாதியாகக் குறைத்த 5 இலவச கருவிகள் — சேமியுங்கள்:' },
  { id: 'teardown', label: 'Teardown', hint: 'Feature → business value',
    sample: 'This checkout added one button and lifted sales 18%. Teardown:',
    sampleMs: 'Checkout ini tambah satu butang dan naikkan jualan 18%. Ulasan:',
    sampleZh: '这个结账页加了一个按钮，销量提升18%。拆解：',
    sampleTa: 'இந்த செக்அவுட் ஒரு பொத்தானைச் சேர்த்து விற்பனையை 18% உயர்த்தியது. அலசல்:' },
  { id: 'deepdive', label: 'Tech dive', hint: 'How it works, in layers',
    sample: 'How your feed loads in 200ms without falling over: requests → ranking → cache.',
    sampleMs: 'Macam mana feed dimuat dalam 200ms tanpa gagal: permintaan → ranking → cache.',
    sampleZh: '你的信息流如何在200毫秒内加载而不崩溃：请求→排序→缓存。',
    sampleTa: 'உங்கள் ஃபீட் 200ms-இல் செயலிழக்காமல் ஏற்றுவது எப்படி: கோரிக்கை → தரவரிசை → கேச்.' },
  { id: 'compare', label: 'X vs Y', hint: 'Old way vs modern way',
    sample: 'Posting daily vs posting well — the difference:',
    sampleMs: 'Pos setiap hari vs pos yang berkualiti — bezanya:',
    sampleZh: '天天发和发得好——区别在这里：',
    sampleTa: 'தினமும் பதிவிடுவது vs நன்றாகப் பதிவிடுவது — வித்தியாசம்:' },
  { id: 'casestudy', label: 'Case study', hint: 'Metric-led social proof',
    sample: 'How a 12-person team cut churn 31% in 60 days:',
    sampleMs: 'Macam mana pasukan 12 orang potong churn 31% dalam 60 hari:',
    sampleZh: '一个12人团队如何在60天内将流失率降低31%：',
    sampleTa: '12 பேர் குழு 60 நாட்களில் வாடிக்கையாளர் விலகலை 31% குறைத்தது எப்படி:' },
  { id: 'postmortem', label: 'Post-mortem', hint: 'Honest failure lesson',
    sample: 'We shut down our first product. Honest post-mortem:',
    sampleMs: 'Kami tutup produk pertama kami. Post-mortem yang jujur:',
    sampleZh: '我们关闭了第一个产品。诚实的复盘：',
    sampleTa: 'எங்கள் முதல் தயாரிப்பை மூடிவிட்டோம். நேர்மையான பின்பார்வை:' },
  { id: 'roundup', label: 'Roundup', hint: 'Curated resource vault',
    sample: '6 years of lessons, 7 resources that save you 100+ hours:',
    sampleMs: '6 tahun pengajaran, 7 sumber yang jimatkan 100+ jam anda:',
    sampleZh: '6 年的经验，7 个为你节省 100+ 小时的资源：',
    sampleTa: '6 ஆண்டு பாடங்கள், 100+ மணிநேரத்தை மிச்சப்படுத்தும் 7 வளங்கள்:' },
  { id: 'hottake', label: 'Hot take', hint: 'Debate-sparking opinion',
    sample: 'Unpopular opinion: follower count is a vanity metric.',
    sampleMs: 'Pendapat tak popular: jumlah follower cuma metrik vanity.',
    sampleZh: '不受欢迎的观点：粉丝数只是虚荣指标。',
    sampleTa: 'பிரபலமற்ற கருத்து: பின்தொடர்பவர் எண்ணிக்கை வெறும் பகட்டு அளவீடு.' },
  { id: 'question', label: 'Question', hint: 'Opens by asking',
    sample: 'Be honest: how many of your scheduled posts actually get read?',
    sampleMs: 'Jujur: berapa banyak pos berjadual anda yang betul-betul dibaca?',
    sampleZh: '说实话：你定时发布的帖子，有多少真的有人看？',
    sampleTa: 'நேர்மையாக: உங்கள் திட்டமிட்ட பதிவுகளில் எத்தனை உண்மையில் படிக்கப்படுகின்றன?' },
];

/** Style example in the reader's language (verified set, English fallback). */
export function styleSampleFor(s: StudioStyle, language: string): string {
  if (language === 'Bahasa Melayu') return s.sampleMs;
  if (language === '中文') return s.sampleZh;
  if (language === 'Tamil') return s.sampleTa;
  return s.sample;
}
