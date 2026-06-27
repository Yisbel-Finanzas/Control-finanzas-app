import {
  Wallet, CreditCard, Landmark, ClipboardList, BarChart3,
  Menu, Calendar, Banknote, RefreshCw, X, Plus, Eye, EyeOff,
  Tag, Home, Moon, Sun, LayoutDashboard, Target, Download,
} from 'lucide-react'

const SW = 1.75

export function IconHome({ size = 22 })        { return <Home            size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconMoney({ size = 22 })       { return <CreditCard      size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconBank({ size = 22 })        { return <Landmark        size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconList({ size = 22 })        { return <ClipboardList   size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconChart({ size = 22 })       { return <BarChart3       size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconMenu({ size = 22 })        { return <Menu            size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconWallet({ size = 22 })      { return <Wallet          size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconCalendar({ size = 22 })    { return <Calendar        size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconCash({ size = 22 })        { return <Banknote        size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconCreditCard({ size = 22 })  { return <CreditCard      size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconRepeat({ size = 22 })      { return <RefreshCw       size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconX({ size = 22 })           { return <X               size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconPlus({ size = 22 })        { return <Plus            size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconEye({ size = 18 })         { return <Eye             size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconEyeOff({ size = 18 })      { return <EyeOff          size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconTag({ size = 22 })         { return <Tag             size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconMoon({ size = 20 })        { return <Moon            size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconSun({ size = 20 })         { return <Sun             size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconDashboard({ size = 22 })   { return <LayoutDashboard size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconGoal({ size = 22 })        { return <Target          size={size} strokeWidth={SW} aria-hidden="true" /> }
export function IconDownload({ size = 22 })    { return <Download        size={size} strokeWidth={SW} aria-hidden="true" /> }
