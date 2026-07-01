import { Outlet } from 'react-router';

import { Footer } from '~/components/footer';
import logo from '../../public/logo.png';

const navItems = [
  {
    label: 'Home',
    href: 'https://cinematicsitesofsavannah.com/',
  },
  {
    label: 'Tours',
    href: 'https://cinematicsitesofsavannah.com/savannah-movie-tours/',
    children: [
      {
        label: 'Tour Reviews',
        href: 'https://cinematicsitesofsavannah.com/savannah-movie-tours/cinematic-sites-savannah-tour-reviews/',
      },
    ],
  },
  {
    label: 'What to Expect',
    href: 'https://cinematicsitesofsavannah.com/what-to-expect/',
  },
  {
    label: 'About',
    href: 'https://cinematicsitesofsavannah.com/about/',
  },
  {
    label: 'Our Crew',
    href: 'https://cinematicsitesofsavannah.com/our-crew/',
    children: [
      {
        label: 'Crew Call',
        href: 'https://cinematicsitesofsavannah.com/our-crew/crew-call/',
      },
      {
        label: "Savannah's Supporting Cast",
        href: 'https://cinematicsitesofsavannah.com/our-crew/savannahs-supporting-cast/',
      },
      {
        label: 'Production Terminology',
        href: 'https://cinematicsitesofsavannah.com/our-crew/production-terminology/',
      },
      {
        label: 'Vendors',
        href: 'https://cinematicsitesofsavannah.com/our-crew/vendors/',
      },
    ],
  },
  {
    label: 'FAQs',
    href: 'https://cinematicsitesofsavannah.com/faqs/',
  },
] as const;

export default function Layout() {
  return (
    <div className='min-h-screen bg-background'>
      <header className='fixed top-0 z-50 w-full border-b-2 border-black bg-white'>
        <div className='absolute inset-x-0 top-0 h-6 bg-secondary bg-[url(/nav-banner-bkgrd1.gif)] bg-left-top bg-repeat-x z-10' />
        <div className='relative mx-auto flex max-w-[1980px] items-center bg-white px-4 md:px-8 mt-6'>
          <a href='https://cinematicsitesofsavannah.com/'>
            <img
              alt='Cinematic Sites of Savannah logo'
              className='h-[140px] w-auto pb-2 min-[1100px]:h-[150px]'
              src={logo}
            />
          </a>

          <nav className='flex w-full justify-center pt-6' aria-label='Main'>
            <ul className='flex flex-wrap justify-center gap-x-6 gap-y-2'>
              {navItems.map((item) => (
                <li key={item.href} className='group relative'>
                  <a
                    className='font-heading text-[22px] font-semibold uppercase text-primary transition-colors duration-300 hover:text-brand-teal min-[1100px]:text-2xl'
                    href={item.href}
                  >
                    {item.label}
                  </a>

                  {'children' in item ? (
                    <ul className='invisible absolute left-0 top-full z-10 mt-2 min-w-56 origin-top rounded-sm bg-secondary p-3 text-left opacity-0 shadow-lg transition-[opacity,visibility,transform] duration-200 ease-out group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 motion-safe:-translate-y-1'>
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <a
                            className='block px-2 py-1.5 text-sm font-semibold text-[#13344a] transition-colors duration-300 hover:text-[#466b83]'
                            href={child.href}
                          >
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <div className='pt-[146px]'>
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
