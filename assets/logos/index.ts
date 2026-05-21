/**
 * assets/logos/index.ts
 * ----------------------
 * Single source of truth for endorsement logos in EndorsementsSection.
 *
 * TO ADD A LOGO: drop the image file into this folder and add an entry below.
 * TO REMOVE A LOGO: delete the entry. The scroller adjusts automatically.
 *
 * NOTE: The logo images in this folder are placeholder approximations used
 * for development layout purposes. Before going live, replace each file
 * with the official brand asset obtained from the organisation directly.
 */

export interface LogoEntry {
  name:   string;   // alt text
  source: any;      // require() path — needed for Expo static asset bundling
}

export const LOGOS: LogoEntry[] = [
  { name: 'UK Parliament',          source: require('./parliament.png')   },
  { name: 'Labour Party',           source: require('./labour.png')       },
  { name: 'Conservative Party',     source: require('./conservatives.png')},
  { name: 'Reform UK',              source: require('./reform.png')       },
  { name: 'Liberal Democrats',      source: require('./libdems.png')      },
  { name: 'Google',                 source: require('./google.png')       },
  { name: 'The Daily Telegraph',    source: require('./telegraph.png')    },
  { name: 'Daily Mail',             source: require('./daily-mail.png')   },
  { name: 'Guido Fawkes',           source: require('./guido-fawkes.png') },
  { name: 'Daily Mirror',           source: require('./daily-mirror.png') },
  { name: 'LabourList',             source: require('./labourlist.png')   },
  { name: 'Cavendish',              source: require('./cavendish.png')    },
  { name: 'Edelman',                source: require('./edelman.png')      },
  { name: 'Brunswick Group',        source: require('./brunswick.png')    },
];
