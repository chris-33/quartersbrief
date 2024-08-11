/**
 * Contains helper functions to model individual gun shots.
 */

import erf from 'math-erf';

// 1. Accuracy
// Accuracy is modeled in two dimensions in the game: horizontal and vertical dispersion.
// Horizontal dispersion is the tendency of shots to fall left and right of the aim point, while
// vertical dispersion is the tendency to be too high or too low. In the following, we will discuss
// horizontal dispersion unless otherwise stated.
// 
// 1.1 Horizontal accuracy
// 
// Shot fall is modeled according to two basic parameters: sigma and maximum dispersion. Sigma is
// the tendency of shots to cluster toward the center, while maximum dispersion works as an upper
// limit: shots may never fall further from the aim point than this value.
// 
// Maximum dispersion dmax is a function of range, being interpolated between 0 and the gun's taper distance
// for melee range, then again between the taper distance and the maximum range.
// 
// Sigma is the central tendency of the shot fall. In the game, it is measured in relation to the maximum
// dispersion, e.g. the game data will state a "sigma count" of, say, 1.8 to mean that 1.8 * sigma = dmax.
// Sigma is therefore a function of maximum dispersion and therefore one of range, and can be
// calculated as sigma = dmax / sigmacount. In the following, when we speak of sigma, this
// value is what we mean.
//  
// Mathematically, then, shot fall at a given range is modeled as a truncated normal distribution N with a 
// uniformly distributed re-roll U. 
// 
// N is a normal distribution with mean 0 and variance sigma^2, truncated at -dmax and +dmax. Let phi(x) denote its
// probability density function and PHI(x) its cumulative density function. Clearly, the total probability of a shot falling
// anywhere inside [-dmax,+dmax] is PHI(dmax) - PHI(-dmax). The probability of a shot falling (theoretically) outside this
// interval (and needing to be re-rolled) is then 1 - (PHI(dmax) - PHI(-dmax)). We call this value theta. Note that
// 	theta = 1 - PHI(dmax) + PHI(-dmax)
// 		  = 1 - 1/2 (1 + erf(dmax / (√2*sigma))) + 1/2 (1 + erf(-dmax / (√2*sigma)))
// 		  = 1/2 * (2 - 1 - erf(dmax / (√2*sigma)) + 1 + erf(-dmax / (√2*sigma)))
// 		  = 1/2 * (2 - erf(dmax / (√2*sigma)) + erf(-dmax / (√2*sigma)))
// 		  = 1/2 * (2 - erf(dmax / (√2*sigma)) - erf(dmax / (√2*sigma)))    [because erf(-x) = -erf(x)]
// 		  = 1 - erf(dmax / (√2*sigma))
// 
// U is a uniform distribution on [-dmax, +dmax]. Its probability density function is 1/2*dmax.
// 
// Let X be a random variable with X ~ N and Y be a random variable with Y ~ U.  
// The overall distribution of shots is then a random variable Z = X + theta * Y. 
// (Note that the uniform distribution is adjusted to only account for the percentage of shots that need to be re-rolled.)
// 
// Horizontal miss distance is then modeled by |Z| with pdf
// 
// 	h(x) = 2 * phi(x) + 2 theta / 2 dmax 	if 0 <= x <= dmax, 0 otherwise 
// 	     = 2 * phi(x) + theta / dmax 		if 0 <= x <= dmax, 0 otherwise 
// 
// The expected value of |Z| (expected horizontal miss distance) is calculated according to:
//           ∞
// 	E(|Z|) = ∫x h(x) dx 
//	        -∞
//          dmax
// 	       = ∫x (2 phi(x) + theta / dmax) dx 
//	         0
//          dmax                          dmax
// 	       = ∫x 2 phi(x) dx + theta/dmax * ∫x dx
//	         0                             0    
//          dmax                        
// 	       = ∫x 2 phi(x) dx + theta * dmax/2
//	         0                             
//
// 	       = pi * √(2/pi) (1 - exp(-dmax^2 / (2*sigma^2))) + theta * dmax/2         [see https://math.stackexchange.com/questions/4927721/expected-value-of-this-distribution]
//


/**
 * Returns the (horizontal) dispersion for the given gun parameters at the given range.
 */
export function dispersion(range, gunParams) {
	// Horizontal dispersion grows linearly from 0 until it reaches taperDist,
	// then resumes growing linearly from that point at a different rate such that it reaches 
	// idealRadius at idealDistance.
	return range * (gunParams.idealRadius - gunParams.minRadius) / gunParams.idealDistance + gunParams.minRadius * Math.min(1, range / gunParams.taperDist);
}

/**
 * Returns the expected horizontal miss distance for the given gun parameters at the given range.
 *  
 * Passing `dmax` is optional. It can be passed if known to save the need for recalculation. 
 */
export function expectedHorizontalMissDistance(range, gunParams, dmax) {
	dmax ??= dispersion(range, gunParams);
	if (dmax === 0) 
		return 0;

	const sigma = dmax / gunParams.sigmaCount;
	const theta = 1 - erf(dmax / (Math.sqrt(2) * sigma));
	
	return Math.PI * Math.sqrt(2 / Math.PI) * (1 - Math.exp(-1 * dmax**2 / (2 * sigma**2))) + theta * dmax/2;
}


// 1.2 Vertical accuracy
// 
// Vertical accuracy is a function of horizontal accuracy. It is calculated as
// 
// 	maximum vertical miss distance = vertical coefficient * maximum horizontal miss distance
// 
// Since the vertical coefficient is only dependent on the shot range, its expected value can be calculated in the same way:
// 
// 	expected vertical miss distance = vertical coefficient * expected horizontal miss distance

/**
 * Returns the vertical coefficient for the given gun parameters at the given range. 
 * Vertical dispersion can be calculated using this value as `dispersion(range, gunParams) * verticalCoeff(range, gunParams)`.
 */
export function verticalCoeff(range, gunParams) {
	// The vertical coefficient is linearly interpolated between radiusOnZero (at 0m), radiusOnDelim (at delim * maxDist),
	// and radiusOnMax (at max range).
	const delimRange = gunParams.delim * gunParams.maxRange;
	return gunParams.radiusOnZero 
			+ (gunParams.radiusOnDelim - gunParams.radiusOnZero) * Math.min(range/delimRange, 1) 
			+ (gunParams.radiusOnMax - gunParams.radiusOnDelim) * Math.max((range - delimRange) / (gunParams.maxRange - delimRange),0)
}

/**
 * Returns the expected horizontal miss distance for the given gun parameters at the given range.
 *  
 * Passing `dmax` is optional. It can be passed if known to save the need for recalculation. 
 */
export function expectedVerticalMissDistance(range, gunParams, dmax) {
	return expectedHorizontalMissDistance(range, gunParams, dmax) * verticalCoeff(range, gunParams);
}