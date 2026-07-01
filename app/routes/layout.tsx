import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useState } from 'react';
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

function getMobileSubmenuId(href: string) {
  return `mobile-submenu-${href.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMobileSubmenu, setOpenMobileSubmenu] = useState<string | null>(
    null,
  );

  return (
    <div className='min-h-screen bg-background'>
      <header className='fixed top-0 z-50 w-full border-b-2 border-black bg-white'>
        <div className='absolute inset-x-0 top-0 h-6 bg-secondary bg-[url(/nav-banner-bkgrd1.gif)] bg-left-top bg-repeat-x z-10' />
        <div className='relative mx-auto mt-6 max-w-[1980px] bg-white px-4 md:px-8'>
          <div className='flex items-center justify-between md:justify-start'>
            <a href='https://cinematicsitesofsavannah.com/'>
              <img
                alt='Cinematic Sites of Savannah logo'
                className='h-24 w-auto pb-2 md:h-[140px] min-[1100px]:h-[150px]'
                src={logo}
              />
            </a>

            <button
              type='button'
              aria-controls='mobile-main-nav'
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className='inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border text-primary transition-colors duration-300 hover:bg-muted md:hidden'
            >
              {menuOpen ? <X className='size-5' /> : <Menu className='size-5' />}
              <span className='sr-only'>Toggle navigation</span>
            </button>

            <nav className='hidden w-full justify-center pt-6 md:flex' aria-label='Main'>
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

          <nav
            id='mobile-main-nav'
            aria-label='Main'
            className={`${menuOpen ? 'block' : 'hidden'} border-t border-border py-3 md:hidden`}
          >
            <ul className='space-y-1'>
              {navItems.map((item) => {
                const submenuId = getMobileSubmenuId(item.href);

                return (
                  <li key={item.href}>
                    {'children' in item ? (
                      <>
                        <button
                          type='button'
                          aria-controls={submenuId}
                          aria-expanded={openMobileSubmenu === item.href}
                          onClick={() =>
                            setOpenMobileSubmenu((open) =>
                              open === item.href ? null : item.href,
                            )
                          }
                          className='flex min-h-11 w-full items-center justify-between font-heading text-xl font-semibold uppercase text-primary transition-colors duration-300 hover:text-brand-teal'
                        >
                          {item.label}
                          <ChevronDown
                            className={`size-4 transition-transform duration-200 ${openMobileSubmenu === item.href ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {openMobileSubmenu === item.href ? (
                            <motion.ul
                              id={submenuId}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                              className='mb-2 border-l border-border pl-4'
                            >
                              <li>
                                <a
                                  className='flex min-h-11 items-center text-sm font-semibold text-[#13344a] transition-colors duration-300 hover:text-[#466b83]'
                                  href={item.href}
                                >
                                  {item.label} overview
                                </a>
                              </li>
                              {item.children.map((child) => (
                                <li key={child.href}>
                                  <a
                                    className='flex min-h-11 items-center text-sm font-semibold text-[#13344a] transition-colors duration-300 hover:text-[#466b83]'
                                    href={child.href}
                                  >
                                    {child.label}
                                  </a>
                                </li>
                              ))}
                            </motion.ul>
                          ) : null}
                        </AnimatePresence>
                      </>
                    ) : (
                      <a
                        className='flex min-h-11 items-center font-heading text-xl font-semibold uppercase text-primary transition-colors duration-300 hover:text-brand-teal'
                        href={item.href}
                      >
                        {item.label}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <div className='pt-[126px] md:pt-[146px]'>
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
