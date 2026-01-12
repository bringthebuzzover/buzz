import "./collegeBanner.css"
import brown from "../../assets/brown.png"
import columbia from "../../assets/columbia.png"
import cornell from "../../assets/cornell.png"
import dartmouth from "../../assets/dartmouth.png"
import harvard from "../../assets/harvard.png"
import princeton from "../../assets/princeton.png"
import upenn from "../../assets/upenn.png"
import yale from "../../assets/yale.png"

const logos = [brown, columbia, cornell, dartmouth, harvard, princeton, yale, upenn]

export default function CollegeBanner() {
    return (
        <section className="college-network">
            <h2>
                Our College Network
            </h2>
            <div className="logo-carousel">
                <div className = "logo-track">
                    {[...logos, ...logos].map((logo,i) => (<img key = {i} src = {logo} alt = "College logo" />))}
                </div>
            </div>
            <p>
                Our ambassadors are ready to bring your brand to top campuses nationwide
            </p>
        </section>
    )
}