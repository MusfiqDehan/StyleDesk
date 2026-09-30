export interface SisterConcernsData {
  id?: string
  aboveText?: string
  mainText?: string
  subText?: string
  buttonText?: string
  buttonLink?: string
  imageUrl?: string
}

export const SISTER_CONCERNS_DEFAULTS: Required<
  Pick<SisterConcernsData, 'aboveText' | 'mainText' | 'subText' | 'buttonText' | 'buttonLink' | 'imageUrl'>
> = {
  aboveText: 'Sister Concerns',
  mainText: 'Meher by *Samina Sara*',
  subText:
    'The first of its kind in Bangladesh, Meher represents luxury outfits for those who see fashion as an extension of taste based in Banani, Dhaka.',
  buttonText: 'Visit Meher',
  buttonLink: 'https://www.meherbd.com/',
  imageUrl: '/sister-concerns-meher-hero.avif',
}

export function resolveSisterConcernsContent(data: SisterConcernsData | null) {
  return {
    aboveText: data?.aboveText?.trim() || SISTER_CONCERNS_DEFAULTS.aboveText,
    mainText: data?.mainText?.trim() || SISTER_CONCERNS_DEFAULTS.mainText,
    subText: data?.subText?.trim() || SISTER_CONCERNS_DEFAULTS.subText,
    buttonText: data?.buttonText?.trim() || SISTER_CONCERNS_DEFAULTS.buttonText,
    buttonLink: data?.buttonLink?.trim() || SISTER_CONCERNS_DEFAULTS.buttonLink,
    imageUrl: data?.imageUrl?.trim() || SISTER_CONCERNS_DEFAULTS.imageUrl,
  }
}
