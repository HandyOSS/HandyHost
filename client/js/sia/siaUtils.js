import BigNumber from '../../external/bignumber.mjs';

BigNumber.config({ EXPONENTIAL_AT: 1e+9 });
BigNumber.config({ DECIMAL_PLACES: 30 });

export const hastingsPerSiacoin = new BigNumber('10').exponentiatedBy(24);

export const siacoinsToHastings = (siacoins) => {
	return new BigNumber(siacoins).times(hastingsPerSiacoin);
}
export const hastingsToSiacoins = (hastings) => {
	return new BigNumber(hastings).dividedBy(hastingsPerSiacoin);
}