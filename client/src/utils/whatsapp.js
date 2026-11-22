// Set VITE_WHATSAPP_NUMBER in Vercel (e.g. "91 98765 43210"). Until it is set,
// the enquiry buttons stay hidden.
const digits = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');

// wa.me needs the country code; assume India for a bare 10-digit number.
const NUMBER = digits.length === 10 ? `91${digits}` : digits;

export const hasWhatsApp = NUMBER.length > 0;

export const callLink = `tel:+${NUMBER}`;
// "919876543210" -> "+91 98765 43210"
export const formatPhone = (digits) => (digits.length === 12 && digits.startsWith('91')
  ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  : `+${digits}`);

export const displayNumber = formatPhone(NUMBER);

export function whatsappLink(message) {
  return `https://wa.me/${NUMBER}?text=${encodeURIComponent(message)}`;
}

export const generalEnquiry = "Hi Ravi Saree Emporium, I'd like to know more about your sarees.";

export function designEnquiry(productId, colourNumbers = []) {
  const url = `${window.location.origin}/product/${encodeURIComponent(productId)}`;
  const colours = colourNumbers.length === 0 ? ''
    : colourNumbers.length === 1 ? `, colour ${colourNumbers[0]}`
    : `, colours ${colourNumbers.join(', ')}`;
  return `Hi, I'm interested in design ${productId}${colours}.\n${url}`;
}
