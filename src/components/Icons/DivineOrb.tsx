interface Props {
  className?: string;
}

const DivineOrb = ({ className = "h-8 w-8" }: Props) => (
  <img
    src="https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyModValues.png"
    alt="Divine Orb"
    className={className}
  />
);

export default DivineOrb;
