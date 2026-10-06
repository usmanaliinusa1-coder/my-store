import { Link } from 'react-router-dom'
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Twitter } from 'lucide-react'
import { useSettingsStore, useStoreName } from '@/store/settingsStore'
import { BRAND } from '@/config/brand'

export function Footer() {
  const name = useStoreName()
  const s = useSettingsStore((st) => st.settings)
  const whatsappDigits = s?.whatsapp_number?.replace(/\D/g, '')

  const socials = [
    { href: s?.facebook_url, label: 'Facebook', Icon: Facebook },
    { href: s?.instagram_url, label: 'Instagram', Icon: Instagram },
    { href: s?.twitter_url, label: 'Twitter / X', Icon: Twitter },
  ].filter((x) => x.href)

  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="text-lg font-extrabold text-gray-900">{name}</p>
          <p className="mt-2 max-w-xs text-sm text-gray-600">{s?.tagline || BRAND.tagline}</p>
          {socials.length > 0 && (
            <div className="mt-4 flex gap-3">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">Shop</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li><Link className="hover:text-brand-700" to="/shop">All products</Link></li>
            <li><Link className="hover:text-brand-700" to="/cart">Cart</Link></li>
            <li><Link className="hover:text-brand-700" to="/wishlist">Wishlist</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">My account</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li><Link className="hover:text-brand-700" to="/account">Profile</Link></li>
            <li><Link className="hover:text-brand-700" to="/account/orders">Track orders</Link></li>
            <li><Link className="hover:text-brand-700" to="/login">Log in</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900">Contact us</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            {s?.contact_email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                <a className="hover:text-brand-700" href={`mailto:${s.contact_email}`}>{s.contact_email}</a>
              </li>
            )}
            {whatsappDigits && (
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <a className="hover:text-brand-700" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp us
                </a>
              </li>
            )}
            {s?.store_address && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{s.store_address}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} {name}. All rights reserved.
      </div>
    </footer>
  )
}
