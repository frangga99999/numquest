// Ikon dari dua penyedia: Feather (react-feather) dan Iconify (semua set lainnya).
// Nama dengan ":" → Iconify (mis. "ph:house-fill", "mdi:calculator", "lucide:home").
// Nama tanpa ":" → Feather (backward-compat).
import React from 'react'
import { Icon as Iconify } from '@iconify/react'
import {
  Activity, AlertCircle, Award, ArrowUp, BookOpen, Calendar, Check, ChevronRight, Clock, Compass,
  Crosshair, Disc, Eye, Flag, Grid, Heart, HelpCircle, Home, Layers, Lock, LogOut, Map,
  MessageSquare, Moon, Play, Plus, Radio, RotateCcw, Send, Settings, Shield, ShoppingBag,
  ShoppingCart, Star, Sun, Sunrise, Target, Tool, TrendingUp, UserPlus, Users, X, Zap,
} from 'react-feather'

const SET = {
  activity: Activity, 'alert-circle': AlertCircle, award: Award, 'arrow-up': ArrowUp,
  'book-open': BookOpen, calendar: Calendar, check: Check, 'chevron-right': ChevronRight,
  clock: Clock, compass: Compass, crosshair: Crosshair, disc: Disc, eye: Eye, flag: Flag,
  grid: Grid, heart: Heart, 'help-circle': HelpCircle, home: Home, layers: Layers, lock: Lock,
  'log-out': LogOut, map: Map, 'message-square': MessageSquare, moon: Moon, play: Play,
  plus: Plus, radio: Radio, 'rotate-ccw': RotateCcw, send: Send, settings: Settings,
  shield: Shield, 'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart, star: Star,
  sun: Sun, sunrise: Sunrise, target: Target, tool: Tool, 'trending-up': TrendingUp,
  'user-plus': UserPlus, users: Users, x: X, zap: Zap,
}

export default function Icon({ name, size = 20, fill = 'none', color, ...rest }) {
  if (name && name.includes(':')) {
    return (
      <Iconify
        icon={name}
        width={size}
        height={size}
        style={color ? { color } : undefined}
        aria-hidden
        {...rest}
      />
    )
  }
  const C = SET[name] || Disc
  return <C size={size} fill={fill} strokeWidth={2} color={color} aria-hidden {...rest} />
}
