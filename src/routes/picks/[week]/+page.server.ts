import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
  const week = params.week || 1

  const response = await fetch(`/api/picks/${week}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch picks for week ${week}. Status: ${response.status}`)
  }

  const data = await response.json()

  function getRandomInsult() {
    // lifted from https://github.com/SydneyRain/insult/blob/master/src/data/insults.js which is sadly no longer maintained
    const insults: Array<string> = [
      'Your birth certificate is an apology letter from the condom factory.',
      'I\'d like to see things from your point of view but I can\'t seem to get my head that far up my ass.',
      'You must have been born on a highway because that\'s where most accidents happen.',
      'Better to let people think you\'re smart until you open your mouth and prove them wrong.',
      'Is your ass jealous of the amount of shit that just came out of your mouth?',
      'You\'re so fat the only letters of the alphabet you know are KFC.',
      'Roses are red, violets are blue, I have 5 fingers, the 3rd ones for you.',
      'Your family tree must be a cactus because everybody on it is a prick.',
      'If I wanted to kill myself I\'d climb your ego and jump to your IQ.',
      'If laughter is the best medicine, your life must be curing the world.',
      'Did you eat paint chips when you were a kid?',
      'I\'m not saying I hate you, but I would unplug your life support to charge my phone.',
      'You\'re so ugly, when your mom dropped you off at school she got a fine for littering.',
      'Shock me, say something intelligent.',
      'I\'m jealous of all the people that haven\'t met you!.',
      'Don\'t feel sad, don\'t feel blue, Frankenstein was ugly too.',
      'I could eat a bowl of alphabet soup and shit out a smarter statement than that.',
      'If you are going to be two faced, at least make one of them pretty.',
      'I may love to shop but I\'m not buying your bullshit.',
      'Why don\'t you slip into something more comfortable -- like a coma.',
      'You look like something I\'d draw with my left hand.',
      'It\'s better to keep your mouth shut and give the \'impression\' that you\'re stupid than to open it and remove all doubt.',
      'It\'s too bad stupidity isn\'t painful.',
      'What\'s the difference between you and eggs? Eggs get laid and you don\'t.',
      'At least when I do a handstand my stomach doesn\'t hit me in the face.',
      'The last time I saw a face like yours I fed it a banana.',
      'If assholes could fly, this place would be an airport!',
      'You are proof that God has a sense of humor.',
      'You are so stupid, you\'d trip over a cordless phone.',
      'Hey, you have something on your chin... no, the 3rd one down.',
      'Ordinarily people live and learn. You just live.',
      'Aww, it\'s so cute when you try to talk about things you don\'t understand.',
      'If a crackhead saw you, he\'d think he needs to go on a diet.',
      'Learn from your parents\' mistakes - use birth control!',
      'When was the last time you could see your whole body in the mirror?',
      'I wish you no harm, but it would have been much better if you had never lived.',
      'If what you don\'t know can\'t hurt you, you\'re invulnerable.',
      'I heard you took an IQ test and they said your results were negative.',
      'If you had another brain, it would be lonely.',
      'You act like your arrogance is a virtue.',
      'We all sprang from apes, but you didn\'t spring far enough.',
      'You must think you\'re strong, but you only smell strong.',
      'Ever since I saw you in your family tree, I\'ve wanted to cut it down.',
      'If you spoke your mind, you\'d be speechless.',
      'Is your name Maple Syrup? It should be, you sap.',
      'Your mom must have a really loud bark!',
      'You\'re the reason why women earn 75 cents to the dollar.',
      'Why don\'t you let that hole under your nose heal up?',
      'For those who never forget a face, you are an exception.',
    ]
    const randomIndex = Math.floor(Math.random() * insults.length)
    return insults[randomIndex]
  }

  return { picks: data.picks, totalPoints: data.totalPoints, insult: getRandomInsult(), week }
}