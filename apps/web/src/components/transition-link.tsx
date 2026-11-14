import { type ComponentProps, forwardRef } from 'react'
import { Link, NavLink, type To, useLocation, useNavigate, useResolvedPath } from 'react-router'

function useLeavesPage(to: To) {
  const { pathname } = useLocation()
  return useResolvedPath(to).pathname !== pathname
}

export const TLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function TLink(props, ref) {
  const leaves = useLeavesPage(props.to)
  return <Link ref={ref} viewTransition={leaves} {...props} />
})

export const TNavLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NavLink>>(function TNavLink(props, ref) {
  const leaves = useLeavesPage(props.to)
  return <NavLink ref={ref} viewTransition={leaves} {...props} />
})

export function useTransitionNavigate() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (to: string) => navigate(to, { viewTransition: new URL(to, window.location.origin).pathname !== pathname })
}
