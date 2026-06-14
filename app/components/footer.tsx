const footerLinks = [
  ['Home', 'https://cinematicsitesofsavannah.com/'],
  ['Tours', 'https://cinematicsitesofsavannah.com/savannah-movie-tours/'],
  ['What to Expect', 'https://cinematicsitesofsavannah.com/what-to-expect/'],
  ['About', 'https://cinematicsitesofsavannah.com/about/'],
  ['Our Crew', 'https://cinematicsitesofsavannah.com/our-crew/'],
  ['FAQs', 'https://cinematicsitesofsavannah.com/faqs/'],
] as const;

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='bg-primary px-4 py-10 text-center text-white md:px-8'>
      <img
        src='/logo-footer.png'
        alt='Cinematic Sites of Savannah'
        className='mx-auto h-36 w-auto md:h-44'
      />

      <div className='mx-auto mt-8 grid max-w-5xl gap-8 text-base md:grid-cols-3'>
        <nav aria-label='Footer navigation'>
          <ul className='space-y-2'>
            {footerLinks.map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  className='transition-colors duration-300 hover:text-brand-teal-muted'
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className='space-y-2'>
          <p>Cinematic Sites of Savannah ®</p>
          <p>Savannah, GA</p>
          <a
            href='tel:+19126440361'
            className='block transition-colors duration-300 hover:text-brand-teal-muted'
          >
            912-644-0361
          </a>
          <a
            href='mailto:info@cinematicsitesofsavannah.com'
            className='block transition-colors duration-300 hover:text-brand-teal-muted'
          >
            Email Us
          </a>
        </div>

        <div className='space-y-2'>
          <p>Office Hours:</p>
          <p>Monday-Friday</p>
          <p>8am-6pm</p>
        </div>
      </div>

      <p className='mt-10 text-sm'>
        © {currentYear} | All rights reserved. Site by{' '}
        <a
          href='http://www.juliegarmandesign.com'
          className='transition-colors duration-300 hover:text-brand-teal-muted'
        >
          Julie Garman Design
        </a>
        .
      </p>
    </footer>
  );
}
