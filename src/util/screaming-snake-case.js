export default function screamingSnakeCase(text) {
	// Text must be in camel case for this to work
	text = text.replace(/[A-Z]/g, (match, offset) => `${(offset > 0 ? '_' : '')}${match}`);
	return text.toUpperCase();
}