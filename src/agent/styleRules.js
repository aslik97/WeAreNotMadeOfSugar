'use strict';

const STYLE_RULES = {
  Clear: {
    mood: 'vibrant, sunlit, optimistic',
    palette: 'golden hour palette with warm yellows, sky blues, soft oranges',
    lighting: 'bright natural sunlight, soft rim light, lens flare',
    modifiers: 'crisp shadows, vivid saturation, lifestyle photography',
    contentClass: 'photo',
  },
  Clouds: {
    mood: 'soft, contemplative, balanced',
    palette: 'muted blue-grey palette with diffused highlights',
    lighting: 'overcast soft light, even shadowless illumination',
    modifiers: 'film grain, gentle contrast, editorial photography',
    contentClass: 'photo',
  },
  Rain: {
    mood: 'dramatic, moody, cinematic',
    palette: 'cool teal and slate palette with neon accents',
    lighting: 'wet reflective streets, glowing puddles, low-key lighting',
    modifiers: 'rain droplets on glass, motion in raindrops, cinematic depth of field',
    contentClass: 'photo',
  },
  Drizzle: {
    mood: 'soft, atmospheric, intimate',
    palette: 'muted greens and cool greys with hints of amber',
    lighting: 'soft hazy daylight through light rain',
    modifiers: 'mist in the air, fine rain texture, painterly photography',
    contentClass: 'photo',
  },
  Thunderstorm: {
    mood: 'epic, dramatic, intense',
    palette: 'deep indigo, electric purple, stark white highlights',
    lighting: 'lightning flashes, dramatic chiaroscuro, stormy skies',
    modifiers: 'volumetric clouds, high contrast, cinematic wide shot',
    contentClass: 'photo',
  },
  Snow: {
    mood: 'serene, magical, peaceful',
    palette: 'cool whites, soft blues, gentle pastels',
    lighting: 'diffused snowy daylight, soft glow, fresh powder',
    modifiers: 'falling snowflakes, frosted textures, winter wonderland',
    contentClass: 'photo',
  },
  Mist: {
    mood: 'ethereal, mysterious, dreamy',
    palette: 'soft greys with hints of pale violet',
    lighting: 'low visibility, soft volumetric haze, diffused light',
    modifiers: 'fog rolling in, atmospheric perspective, painterly mood',
    contentClass: 'photo',
  },
  Fog: {
    mood: 'mysterious, cinematic, minimalist',
    palette: 'monochrome grey with selective accent colors',
    lighting: 'dense fog, glowing distant lights, low contrast',
    modifiers: 'silhouettes in fog, moody atmosphere, soft focus',
    contentClass: 'photo',
  },
  Haze: {
    mood: 'warm, hazy, nostalgic',
    palette: 'amber, dusty rose, soft sepia tones',
    lighting: 'hazy sunlight, gentle bloom, warm glow',
    modifiers: 'sun flares, vintage film look, slight grain',
    contentClass: 'photo',
  },
  Smoke: {
    mood: 'gritty, dramatic, intense',
    palette: 'charcoal greys and burnt oranges',
    lighting: 'smoky low-key lighting, harsh contrast',
    modifiers: 'wisps of smoke, cinematic depth, dramatic atmosphere',
    contentClass: 'photo',
  },
  Dust: {
    mood: 'warm, rugged, expansive',
    palette: 'sandy ochres, deep terracotta, sun-bleached tones',
    lighting: 'harsh sunlight through dust, warm haze',
    modifiers: 'wind-blown dust, desert atmosphere, cinematic wide shot',
    contentClass: 'photo',
  },
  Sand: {
    mood: 'warm, rugged, expansive',
    palette: 'sandy ochres, deep terracotta, sun-bleached tones',
    lighting: 'harsh sunlight through sand, warm haze',
    modifiers: 'wind-blown sand, desert atmosphere, cinematic wide shot',
    contentClass: 'photo',
  },
  Ash: {
    mood: 'apocalyptic, somber, cinematic',
    palette: 'ashen greys, muted ember oranges',
    lighting: 'overcast with falling ash, low contrast',
    modifiers: 'ash particles in the air, moody atmosphere',
    contentClass: 'photo',
  },
  Squall: {
    mood: 'turbulent, energetic, dramatic',
    palette: 'stormy blues and greys with bright highlights',
    lighting: 'gusty wind-driven light, dynamic shadows',
    modifiers: 'flying debris, motion blur, intense weather',
    contentClass: 'photo',
  },
  Tornado: {
    mood: 'epic, ominous, dramatic',
    palette: 'dark greens, slate greys, ominous skies',
    lighting: 'eerie pre-storm light, dramatic clouds',
    modifiers: 'funnel cloud in distance, debris in air, cinematic',
    contentClass: 'photo',
  },
};

function getRule(main) {
  return STYLE_RULES[main] || STYLE_RULES.Clear;
}

function buildPrompt({ city, weather, brandContext, userTextFields }) {
  const rule = getRule(weather.main);
  const tempNote =
    typeof weather.temp === 'number'
      ? `, ambient temperature ${Math.round(weather.temp)}°C`
      : '';
  const desc = weather.description ? `, ${weather.description}` : '';

  const brandLine =
    brandContext && brandContext.trim()
      ? `, brand context: ${brandContext.trim()}`
      : '';

  const headlineFields = (userTextFields || [])
    .map((f) => (typeof f === 'string' ? f : f && f.text))
    .filter(Boolean);
  const headlineLine = headlineFields.length
    ? `, conceptually inspired by themes: "${headlineFields.join('; ')}"`
    : '';

  const prompt = [
    `${rule.mood} marketing visual for ${city}${desc}${tempNote}`,
    rule.palette,
    rule.lighting,
    rule.modifiers,
    'brand-safe composition with negative space for typography',
    'high-detail, photorealistic, 4k',
  ].join(', ');

  return {
    prompt: `${prompt}${brandLine}${headlineLine}`,
    contentClass: rule.contentClass,
    rule,
  };
}

module.exports = { STYLE_RULES, getRule, buildPrompt };
