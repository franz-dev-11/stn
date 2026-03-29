import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  LayoutDashboardIcon,
  UserPlus,
  Users,
  ShoppingCart,
  Tag,
  Truck,
  Calculator,
  MoreVertical,
  Package,
  History,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import stnLogo from "../assets/stn logo.png";

const Sidebar = ({
  currentPage,
  setCurrentPage,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    name: "User",
    role: "Staff",
    email: "",
    avatarUrl: "",
  });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    const BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || "avatars";

    const mapAuthUser = async (authUser) => {
      if (!authUser) return;

      let avatarUrl = authUser.user_metadata?.avatar_url || "";
      const avatarPath = authUser.user_metadata?.avatar_path || "";

      if (avatarPath) {
        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(avatarPath, 31536000);
        if (signedData?.signedUrl) avatarUrl = signedData.signedUrl;
      }

      setUser({
        name:
          authUser.user_metadata?.full_name ||
          authUser.email?.split("@")[0] ||
          "User",
        role: authUser.user_metadata?.role || "Administrator",
        email: authUser.email || "",
        avatarUrl,
      });
    };

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      mapAuthUser(authUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      mapAuthUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Standard menu sections
  const menuSections = [
    {
      title: "INVENTORY",
      items: [
        {
          icon: <LayoutDashboardIcon size={20} />,
          label: "Dashboard",
          path: "/dashboard",
        },
        { icon: <Package size={20} />, label: "Inventory", path: "/inventory" },
      ],
    },
    {
      title: "PRICING",
      items: [
        { icon: <Tag size={20} />, label: "Edit Pricing", path: "/pricing" },
      ],
    },
    {
      title: "INBOUND",
      items: [
        {
          icon: <ShoppingCart size={20} />,
          label: "Procurement",
          path: "/purchasing",
        },
        {
          icon: <History size={20} />,
          label: "Procurement History",
          path: "/purchase-history",
        },
        {
          icon: <Truck size={20} />,
          label: "Inbound Delivery",
          path: "/inbound",
        },
      ],
    },
    {
      title: "OUTBOUND",
      items: [
        {
          icon: <Calculator size={20} />,
          label: "Point of Sales",
          path: "/pos",
        },
        {
          icon: <History size={20} />,
          label: "Invoice History",
          path: "/invoice-history",
        },
        {
          icon: <Truck size={20} />,
          label: "Outbound Delivery",
          path: "/outbound",
        },
      ],
    },
  ];

  // Dynamic section for Super Admin
  const adminSection =
    user.role === "Super Admin"
      ? {
          title: "ADMINISTRATION",
          items: [
            {
              icon: <ShieldCheck size={20} />,
              label: "Manage Users",
              path: "/manage-users",
            },
          ],
        }
      : null;

  const NavItem = ({ icon, label, path }) => {
    const isActive = currentPage === label;
    return (
      <div
        onClick={() => {
          setCurrentPage(label);
          navigate(path);
          setIsMobileMenuOpen(false);
        }}
        className={`flex items-center space-x-1.5 sm:space-x-2 p-1.5 sm:p-2 mb-0.5 cursor-pointer transition-all duration-200 rounded-lg 
          ${isActive ? "bg-teal-500/40 text-teal-900 shadow-sm" : "hover:bg-teal-50 text-slate-600"}`}
      >
        <span
          className={`shrink-0 ${isActive ? "text-teal-900" : "text-teal-800"}`}
        >
          {icon}
        </span>
        <span className='font-bold text-[10px] sm:text-xs truncate'>
          {label}
        </span>
      </div>
    );
  };

  return (
    <>
      <div
        className={`fixed md:static w-72 h-screen bg-white border-r border-gray-100 font-sans shadow-sm transition-all duration-300 z-50 md:z-auto flex flex-col ${
          isMobileMenuOpen ? "left-0" : "-left-72"
        }`}
      >
        <div className='p-2 sm:p-3 flex justify-center'>
          <img
            src={stnLogo}
            alt='Logo'
            className='h-12 sm:h-14 w-auto object-contain'
          />
        </div>

        <div className='flex-1 overflow-y-hidden px-3'>
          {/* Render standard sections */}
          {menuSections.map((section, idx) => (
            <div
              key={idx}
              className='mb-2 sm:mb-3 border-t border-gray-100 pt-2 sm:pt-3'
            >
              <h3 className='text-[8px] sm:text-[9px] font-bold text-gray-400 tracking-[0.15em] mb-2 sm:mb-2 ml-2 sm:ml-2 uppercase'>
                {section.title}
              </h3>
              {section.items.map((item, i) => (
                <NavItem
                  key={i}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                />
              ))}
            </div>
          ))}

          {/* Render Admin section if it exists */}
          {adminSection && (
            <div className='mb-2 sm:mb-3 border-t border-gray-100 pt-2 sm:pt-3'>
              <h3 className='text-[8px] sm:text-[9px] font-bold text-gray-400 tracking-[0.15em] mb-2 sm:mb-2 ml-2 sm:ml-2 uppercase'>
                {adminSection.title}
              </h3>
              {adminSection.items.map((item, i) => (
                <NavItem
                  key={i}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                />
              ))}
            </div>
          )}
        </div>

        <div className='p-2 sm:p-2 border-t border-gray-100'>
          <div className='flex items-center space-x-2 p-1 relative'>
            <div className='w-8 sm:w-8 h-8 sm:h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs uppercase'>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt='Profile avatar'
                  className='w-full h-full object-cover'
                />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[10px] sm:text-xs font-bold text-slate-800 truncate'>
                {user.name}
              </p>
              <p className='text-[8px] sm:text-[9px] text-slate-400 truncate'>
                {user.role}
              </p>
            </div>
            <button
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className='text-gray-400 hover:text-slate-700 shrink-0'
              aria-label='Profile options'
            >
              <MoreVertical size={16} className='sm:w-4.5 sm:h-4.5' />
            </button>

            {isProfileMenuOpen && (
              <div className='absolute right-0 bottom-12 w-36 sm:w-40 rounded-lg border border-slate-200 bg-white shadow-lg py-0.5 z-30'>
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    supabase.auth.signOut();
                  }}
                  className='w-full text-left px-2 sm:px-3 py-1.5 text-[8px] sm:text-[9px] text-rose-600 hover:bg-rose-50 flex items-center gap-1.5'
                >
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />
    </>
  );
};

export default Sidebar;
